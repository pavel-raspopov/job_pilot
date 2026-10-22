import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { searchJobs, type AdzunaJob } from "@/agent/adzuna";
import { scoreJobs, type ScoredMatch } from "@/agent/matcher";
import {
  AI_ROUTE,
  checkAiRateLimit,
  recordAiCall,
  retryAfterPhrase,
} from "@/lib/ai-rate-limit";
import { createInsforgeServer } from "@/lib/insforge-server";
import { parseProfileRow } from "@/lib/parse-profile";
import { getPostHogClient } from "@/lib/posthog-server";
import { HIGH_MATCH_THRESHOLD } from "@/lib/utils";
import type { FindActionResult } from "@/types";

/**
 * Adzuna job discovery.
 *
 * The first route in this app where a button press spends money: one batched
 * gateway call (two when the first reply leaves jobs unscored — see
 * `scoreJobs`; none when every listing is already saved with a score) plus one
 * request against a shared Adzuna quota. Only listings the user does not
 * already have are saved — `jobs.external_id` is the key — and only those, plus
 * saved ones whose first scoring failed, are scored. `maxDuration`
 * must be at least `AI_TIMEOUT_MS` (120s) or the route inherits the platform
 * default and dies in production while passing every local test.
 */
export const maxDuration = 120;

type InsforgeServerClient = Awaited<ReturnType<typeof createInsforgeServer>>;

const AUTH_ERROR = "You must be signed in to search for jobs.";
const INVALID_INPUT_ERROR = "Enter a job title to search for.";
const NO_PROFILE_ERROR = "Save your profile before searching for jobs.";
const INCOMPLETE_PROFILE_ERROR =
  "Add your job title and skills to your profile before searching.";
/**
 * Kept distinct from SERVICE_ERROR on purpose: "the job board is down" and "we
 * failed" imply different retry decisions, and the distinction costs one string.
 */
const SEARCH_ERROR = "Job search is unavailable right now. Please try again.";
const SERVICE_ERROR = "Could not complete your search. Please try again.";
const RATE_LIMIT_ERROR = "Too many searches in the last hour.";

const bodySchema = z.object({
  jobTitle: z.string().trim().min(1).max(100),
  location: z.string().trim().max(100).optional(),
});

function fail(error: string): NextResponse {
  return NextResponse.json<FindActionResult>({ success: false, error });
}

/**
 * Best-effort terminal write for a run row.
 *
 * Never throws. The jobs are already saved by the time this runs on the happy
 * path, and a stale bookkeeping row must not turn a successful search into an
 * error the user sees.
 */
async function finishRun(
  insforge: InsforgeServerClient,
  runId: string,
  userId: string,
  status: "completed" | "failed",
  jobsFound: number,
): Promise<void> {
  const { error } = await insforge.database
    .from("agent_runs")
    .update({
      status,
      jobs_found: jobsFound,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId)
    // RLS is not a reason to omit the scope; every query is user-scoped.
    .eq("user_id", userId);

  if (error) {
    console.error("[api/agent/find] could not finish run", error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Declared outside the try so an unexpected throw can still mark the run
  // failed rather than leaving it stuck at 'running' forever — the dashboard's
  // activity feed reads these.
  let runId: string | null = null;
  let insforge: InsforgeServerClient | null = null;
  let userId: string | null = null;

  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return fail(INVALID_INPUT_ERROR);
    }

    const parsedBody = bodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return fail(INVALID_INPUT_ERROR);
    }
    const { jobTitle } = parsedBody.data;
    const location = parsedBody.data.location ?? "";

    insforge = await createInsforgeServer();
    const { data: userData, error: authError } = await insforge.auth.getCurrentUser();
    userId = userData?.user?.id ?? null;

    if (authError || !userId) {
      return fail(AUTH_ERROR);
    }

    const { data: rows, error: loadError } = await insforge.database
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .limit(1);

    if (loadError) {
      console.error("[api/agent/find] could not load the profile", loadError);
      return fail(SERVICE_ERROR);
    }

    const profileRow: unknown = Array.isArray(rows) ? rows[0] : undefined;
    const profile = profileRow === undefined ? null : parseProfileRow(profileRow);

    if (profile === null) {
      return fail(NO_PROFILE_ERROR);
    }

    // A lighter gate than Feature 08's full completeness check: match quality
    // depends on skills, title and experience, not on a phone number. Blocking a
    // search over a missing phone number spends the user's intent on an errand
    // unrelated to what they asked for.
    if (profile.skills.length === 0 && !profile.current_title) {
      return fail(INCOMPLETE_PROFILE_ERROR);
    }

    // ---- everything below this line is billed ----------------------------

    // The check runs before Adzuna so the hourly ceiling bounds the shared
    // provider quota as well as model spend.
    const verdict = await checkAiRateLimit(insforge, userId, AI_ROUTE.agentFind);
    if (!verdict.allowed) {
      return fail(
        `${RATE_LIMIT_ERROR} Please try again ${retryAfterPhrase(
          verdict.retryAfterSeconds,
        )}.`,
      );
    }

    const { data: runRows, error: runError } = await insforge.database
      .from("agent_runs")
      .insert([
        {
          user_id: userId,
          status: "running",
          job_title_searched: jobTitle,
          location_searched: location.length > 0 ? location : null,
        },
      ])
      .select("id")
      .limit(1);

    const runRow: unknown = Array.isArray(runRows) ? runRows[0] : undefined;
    const newRunId =
      typeof runRow === "object" &&
      runRow !== null &&
      typeof (runRow as { id?: unknown }).id === "string"
        ? (runRow as { id: string }).id
        : null;

    if (runError || newRunId === null) {
      console.error("[api/agent/find] could not record the run", runError);
      return fail(SERVICE_ERROR);
    }
    runId = newRunId;

    capture(userId, "job_search_started", { userId, jobTitle, location });

    const search = await searchJobs(jobTitle, location);

    if (!search.success) {
      console.error("[api/agent/find] provider failed:", search.error);
      await finishRun(insforge, runId, userId, "failed", 0);
      return fail(SEARCH_ERROR);
    }

    // Recorded as soon as the provider answers, and deliberately BEFORE the
    // zero-result branch below. The slot counts a search that reached Adzuna,
    // not strictly one that reached the model: a query returning nothing still
    // spends a request against the provider's shared free-tier quota, so if it
    // cost no slot, a loop of zero-result queries would drain that quota while
    // the limiter sat at zero — defeating the reason the check runs before the
    // provider at all. A provider outage still costs nothing; that path
    // returned above.
    await recordAiCall(insforge, userId, AI_ROUTE.agentFind);

    const jobsFound = search.jobs.length;

    if (jobsFound === 0) {
      // Not an error: the search ran, the market was empty. No model call and
      // nothing inserted, but the attempt is counted above.
      await finishRun(insforge, runId, userId, "completed", 0);
      return NextResponse.json<FindActionResult>({
        success: true,
        jobsFound: 0,
        newJobs: 0,
        strongMatches: 0,
      });
    }

    const saved = await loadSavedListings(
      insforge,
      userId,
      search.jobs.map((job) => job.externalId),
    );
    const fresh = search.jobs.filter((job) => !saved.has(job.externalId));
    // Saved, but scoring failed the first time. Re-scoring a SCORED job would
    // bill the user to change a number they have already seen; an unscored one
    // has no number yet, and repeating the search is how the user recovers it.
    const unscored = search.jobs.filter((job) => saved.get(job.externalId) === false);
    console.log(
      "[api/agent/find]",
      jobsFound - fresh.length,
      "of",
      jobsFound,
      "listings already saved,",
      unscored.length,
      "of them unscored",
    );

    if (fresh.length === 0 && unscored.length === 0) {
      // Every listing is already in the list with a score. No model call.
      await finishRun(insforge, runId, userId, "completed", 0);
      return NextResponse.json<FindActionResult>({
        success: true,
        jobsFound,
        newJobs: 0,
        strongMatches: 0,
      });
    }

    // One call for both batches. `scoreJobs` aligns its result to its input, so
    // the first `fresh.length` entries belong to `fresh` — not to `search.jobs`.
    const matches = await scoreJobs(profile, [...fresh, ...unscored]);
    const freshMatches = matches.slice(0, fresh.length);

    const filledIn = await fillMissingScores(
      insforge,
      userId,
      unscored,
      matches.slice(fresh.length),
    );
    if (unscored.length > 0) {
      console.log("[api/agent/find] filled in", filledIn, "of", unscored.length, "missing scores");
    }

    if (fresh.length === 0) {
      // Nothing new to save. A filled-in job is not new and was counted as
      // found when it was first saved, so no count and no event.
      await finishRun(insforge, runId, userId, "completed", 0);
      if (filledIn > 0) {
        revalidatePath("/find-jobs");
      }
      return NextResponse.json<FindActionResult>({
        success: true,
        jobsFound,
        newJobs: 0,
        strongMatches: 0,
      });
    }

    const jobRows = fresh.map((job, index) => {
      const match = freshMatches[index] ?? null;
      return {
        user_id: userId,
        run_id: runId,
        source: "search",
        source_url: null,
        external_id: job.externalId,
        external_apply_url: job.redirectUrl,
        title: job.title,
        company: job.company,
        location: job.location,
        salary: job.salary,
        // Adzuna supplies no employment type. Defaulting it to "fulltime" would
        // fabricate a fact the provider never stated.
        job_type: null,
        about_role: job.description.length > 0 ? job.description : null,
        // Adzuna returns a snippet, not a full posting. Feature 12 fills these.
        responsibilities: null,
        requirements: null,
        nice_to_have: null,
        benefits: null,
        about_company: null,
        match_score: match?.matchScore ?? null,
        match_reason: match?.matchReason ?? null,
        matched_skills: match?.matchedSkills ?? null,
        missing_skills: match?.missingSkills ?? null,
        // `found_at` is omitted deliberately: the column defaults to now(), and
        // letting the database stamp it keeps the relative date the list renders
        // from disagreeing with the server's clock.
      };
    });

    // Conflict-ignoring, not a plain insert. The lookup above races: a second
    // search in another tab can save one of these listings in between, and a
    // plain `insert` is atomic, so one conflicting row would reject all ten.
    // The unique constraint skips that row instead, and the response holds
    // only the rows actually inserted. Never a merge: a saved job keeps its
    // first score and date (a missing score is filled in above, not here).
    const { data: insertedRows, error: insertError } = await insforge.database
      .from("jobs")
      .upsert(jobRows, { onConflict: "user_id,external_id", ignoreDuplicates: true })
      .select("match_score");

    if (insertError) {
      console.error("[api/agent/find] could not save jobs", insertError);
      await finishRun(insforge, runId, userId, "failed", 0);
      return fail(SERVICE_ERROR);
    }

    // Every count below comes from what the database inserted, not from what
    // was sent: when two searches race on one listing, only the one that saved
    // it may count it.
    const savedScores = (Array.isArray(insertedRows) ? insertedRows : []).map(readMatchScore);

    await finishRun(insforge, runId, userId, "completed", savedScores.length);

    const strongMatches = savedScores.filter(
      (score) => (score ?? 0) >= HIGH_MATCH_THRESHOLD,
    ).length;

    await recordFoundJobs(userId, savedScores);

    revalidatePath("/find-jobs");

    return NextResponse.json<FindActionResult>({
      success: true,
      jobsFound,
      newJobs: savedScores.length,
      strongMatches,
    });
  } catch (error) {
    console.error("[api/agent/find] unexpected", error);
    if (insforge !== null && runId !== null && userId !== null) {
      await finishRun(insforge, runId, userId, "failed", 0);
    }
    return fail(SERVICE_ERROR);
  }
}

/**
 * Which of these listings the user has already saved, mapped to whether the
 * saved row has a match score.
 *
 * Never throws. A failed lookup degrades to "none saved" instead of failing
 * the search: the slot is already spent, and the conflict-ignoring insert keeps
 * the list free of duplicates regardless. The cost of degrading is one batch
 * scored that did not need to be.
 */
async function loadSavedListings(
  insforge: InsforgeServerClient,
  userId: string,
  externalIds: string[],
): Promise<Map<string, boolean>> {
  const saved = new Map<string, boolean>();
  try {
    const { data, error } = await insforge.database
      .from("jobs")
      .select("external_id, match_score")
      .eq("user_id", userId)
      .in("external_id", externalIds);

    if (error) {
      console.error("[api/agent/find] could not look up saved listings", error);
      return saved;
    }
    for (const row of Array.isArray(data) ? data : []) {
      const id: unknown = (row as { external_id?: unknown }).external_id;
      if (typeof id === "string") {
        saved.set(id, readMatchScore(row) !== null);
      }
    }
  } catch (error) {
    console.error("[api/agent/find] saved-listing lookup threw", error);
  }
  return saved;
}

/**
 * Writes scores for saved rows that have none. Returns how many rows it filled.
 *
 * Each update is guarded by `match_score IS NULL`, so it can only fill a gap,
 * never overwrite: if a concurrent search filled the row a moment earlier, the
 * update matches nothing. Only the four scoring columns change — the row keeps
 * its date found and its run.
 *
 * Never throws. The jobs are already saved, so a failed fill-in is logged and
 * left for the next search rather than failing this one.
 */
async function fillMissingScores(
  insforge: InsforgeServerClient,
  userId: string,
  jobs: AdzunaJob[],
  matches: (ScoredMatch | null)[],
): Promise<number> {
  let filled = 0;
  for (const [index, job] of jobs.entries()) {
    const match = matches[index] ?? null;
    if (match === null) {
      continue;
    }
    try {
      const { data, error } = await insforge.database
        .from("jobs")
        .update({
          match_score: match.matchScore,
          match_reason: match.matchReason,
          matched_skills: match.matchedSkills,
          missing_skills: match.missingSkills,
        })
        .eq("user_id", userId)
        .eq("external_id", job.externalId)
        .is("match_score", null)
        .select("id");

      if (error) {
        console.error("[api/agent/find] could not fill in a missing score", error);
        continue;
      }
      filled += Array.isArray(data) ? data.length : 0;
    } catch (error) {
      console.error("[api/agent/find] filling in a missing score threw", error);
    }
  }
  return filled;
}

/** A returned row's score, or null for an unscored or unreadable row. */
function readMatchScore(row: unknown): number | null {
  const score: unknown =
    typeof row === "object" && row !== null
      ? (row as { match_score?: unknown }).match_score
      : undefined;
  return typeof score === "number" ? score : null;
}

/** Fire-and-forget capture. Analytics must never fail a search. */
function capture(
  userId: string,
  event: string,
  properties: Record<string, unknown>,
): void {
  try {
    getPostHogClient()?.capture({ distinctId: userId, event, properties });
  } catch (error) {
    console.error("[api/agent/find] analytics capture failed", error);
  }
}

/**
 * One `job_found` per newly saved job, then an explicit flush. A re-found
 * listing is not counted again.
 *
 * `lib/posthog-server.ts` builds the client with `flushAt: 1`, so each capture
 * starts a request immediately — but nothing awaits it. A serverless function
 * can be frozen the moment its response is returned, dropping up to ten events,
 * which are exactly the events the analytics dashboard is built from.
 *
 * Not `shutdown()`: the client is a module singleton the next request reuses.
 */
async function recordFoundJobs(
  userId: string,
  scores: (number | null)[],
): Promise<void> {
  try {
    const client = getPostHogClient();
    if (!client) {
      return;
    }
    for (const matchScore of scores) {
      client.capture({
        distinctId: userId,
        event: "job_found",
        properties: { userId, source: "search", matchScore },
      });
    }
    await client.flush();
  } catch (error) {
    console.error("[api/agent/find] analytics flush failed", error);
  }
}
