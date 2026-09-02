import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { searchJobs } from "@/agent/adzuna";
import { scoreJobs } from "@/agent/matcher";
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
 * gateway call plus one request against a shared Adzuna quota. `maxDuration`
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

    if (search.jobs.length === 0) {
      // Not an error: the search ran, the market was empty. No model call and
      // nothing inserted, but the attempt is counted above.
      await finishRun(insforge, runId, userId, "completed", 0);
      return NextResponse.json<FindActionResult>({
        success: true,
        jobsFound: 0,
        strongMatches: 0,
      });
    }

    const matches = await scoreJobs(profile, search.jobs);

    const jobRows = search.jobs.map((job, index) => {
      const match = matches[index] ?? null;
      return {
        user_id: userId,
        run_id: runId,
        source: "search",
        source_url: null,
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

    const { error: insertError } = await insforge.database.from("jobs").insert(jobRows);

    if (insertError) {
      console.error("[api/agent/find] could not save jobs", insertError);
      await finishRun(insforge, runId, userId, "failed", 0);
      return fail(SERVICE_ERROR);
    }

    await finishRun(insforge, runId, userId, "completed", jobRows.length);

    const strongMatches = jobRows.filter(
      (row) => (row.match_score ?? 0) >= HIGH_MATCH_THRESHOLD,
    ).length;

    await recordFoundJobs(
      userId,
      jobRows.map((row) => row.match_score),
    );

    revalidatePath("/find-jobs");

    return NextResponse.json<FindActionResult>({
      success: true,
      jobsFound: jobRows.length,
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
 * One `job_found` per saved job, then an explicit flush.
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
