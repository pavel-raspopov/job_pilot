import { z } from "zod";

import { createAiClient } from "@/lib/insforge-ai";
import type { Profile } from "@/types";

import type { AdzunaJob } from "@/agent/adzuna";

/**
 * Scores discovered listings against the user's profile.
 *
 * One batched gateway call covers the whole page of results: ten separate calls
 * would cost roughly ten times as much for reasoning the list does not yet show.
 * A second call is made only when the first leaves a job unscored.
 *
 * **Nothing here throws.** Every failure degrades to an unscored batch, because
 * the listings themselves are real and useful, and making the user search again
 * bills them again.
 */

/** One job's assessment against the profile. */
export type ScoredMatch = {
  /** Whole number, 0-100. Clamped here — see `toScore`. */
  matchScore: number;
  matchReason: string;
  matchedSkills: string[];
  missingSkills: string[];
};

/**
 * Model used to score listings against the profile, brokered by the InsForge AI
 * gateway.
 *
 * Measured head-to-head on the SAME payload — the real profile (43 skills, 2
 * roles) against one real ten-listing Adzuna page for "frontend engineer" —
 * token counts from the gateway's own `usage`:
 *
 *   google/gemini-2.5-flash       2666 in /  681 out   ~$0.0025
 *   google/gemini-2.5-flash-lite  2666 in / 1050 out   ~$0.0007   <- chosen
 *
 * This REVERSES the starting assumption. Feature 08 chose flash because
 * flash-lite made a specific, visible error there; on this task it makes none.
 * Both scored 10/10 with correct `job_index`, and both invented zero skills
 * (every `matched_skills` entry was present in the profile's own list, checked
 * in SQL). Flash-lite discriminated slightly better: 7 distinct scores across
 * the ten listings against flash's 6, where flash produced a four-way tie at 70
 * and filled `matched_skills` to the 6 cap on all ten rows, while flash-lite
 * varied 5-6 matched and 1-5 missing per listing. Both ranked the plain
 * "Frontend Engineer" top and "Principal Frontend Engineer" bottom, which is
 * the right read for a mid-level profile.
 *
 * Flash-lite emits ~54% more output tokens but is far cheaper per token, so it
 * still costs ~3.6x less per search. At ~$0.0007 the free plan's $1/month
 * covers roughly 1,400 searches against flash's ~400.
 *
 * Confirmed on a second, different payload ("full stack developer", London/gb):
 * 10/10 scored again, scores spread 30-95. Two payloads is a thin sample —
 * the failure this guards against is a short reply leaving jobs unscored, which
 * shows in the UI as an em dash rather than a wrong number. Revisit if unscored
 * rows start appearing, and re-measure if the prompt or the profile shape
 * changes materially.
 *
 * Unscored rows did appear (2026-09-24), and re-measuring found the cause in
 * the tool call's SHAPE, not in the model's judgement: an intermittent empty
 * `matches` array (see `MAX_SCORING_ATTEMPTS`). All 26 direct replies that
 * were not empty placed all ten jobs with correct indices, so the model stays;
 * `buildMatchingTool`, `requestScores` and the retry handle the shape.
 */
const MATCHING_MODEL = "google/gemini-2.5-flash-lite";

/**
 * Caps output, the dominant cost driver. Ten entries of one short paragraph plus
 * two brief skill lists runs ~1,000 tokens; this leaves roughly 3x headroom.
 *
 * Truncation breaks the tool-call JSON, which gets one retry and otherwise
 * degrades to an unscored batch — the jobs still save — rather than to a
 * half-written set of scores. A real near-miss: one reply repeated the whole
 * list with indices 10-19, spending ~2,000 tokens of this cap.
 */
const MATCHING_MAX_TOKENS = 3072;

/**
 * One retry, made only when the first reply left a job unscored — the backstop
 * behind `buildMatchingTool`'s `minItems`.
 *
 * The failure it was added for: flash-lite sometimes answered the forced tool
 * call with an empty `record_matches({"matches":[]})`. That is a valid call, so
 * nothing upstream rejected it, and on 2026-09-24 a 284-byte reply of exactly
 * that kind saved ten live listings unscored. It is intermittent, not
 * payload-driven — replaying that exact request, 2 of 17 direct calls opened
 * empty, and one of them was recovered by this retry. `minItems` now forbids
 * the empty array itself; the retry still covers what it cannot: a truncated
 * reply, a gateway error, entries with no usable index or score.
 *
 * The retry is billed but does NOT consume a search from the user's allowance —
 * the flakiness is the model's, not the user's. `LIMITS` in
 * `lib/ai-rate-limit.ts` records the ceiling that implies.
 */
const MAX_SCORING_ATTEMPTS = 2;

/**
 * A first attempt slower than this is not retried. The empty reply the retry
 * exists for comes back fast (1.3s measured, against 4-9s for a full one), and
 * a slow attempt followed by a second call could run the route past its
 * `maxDuration` — losing the listings, which are only saved after scoring.
 */
const RETRY_WINDOW_MS = 20_000;

/** Keeps output bounded and the eventual detail view readable. */
const MAX_SKILLS_PER_LIST = 6;

/** Adzuna snippets run 300-500 chars. This bounds a pathological listing. */
const MAX_DESCRIPTION_CHARS = 1200;

/** Same purpose, for a profile's free-text responsibilities. */
const MAX_RESPONSIBILITIES_CHARS = 600;

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

/**
 * The profile facts that bear on a match, and nothing else.
 *
 * Identity fields — name, email, phone, LinkedIn and portfolio links — are
 * deliberately absent. They carry no scoring signal, so sending them would be
 * PII crossing a vendor boundary for nothing.
 */
function buildProfileInput(profile: Profile): string {
  return JSON.stringify(
    {
      current_title: profile.current_title,
      experience_level: profile.experience_level,
      years_experience: profile.years_experience,
      skills: profile.skills,
      industries: profile.industries,
      job_titles_seeking: profile.job_titles_seeking,
      remote_preference: profile.remote_preference,
      location: profile.location,
      preferred_locations: profile.preferred_locations,
      salary_expectation: profile.salary_expectation,
      work_authorization: profile.work_authorization,
      education: profile.education
        ? { degree: profile.education.degree, field: profile.education.field }
        : null,
      roles: (profile.work_experience ?? []).map((role) => ({
        job_title: role.job_title,
        company: role.company,
        currently_working: role.currently_working,
        responsibilities: truncate(role.responsibilities, MAX_RESPONSIBILITIES_CHARS),
      })),
    },
    null,
    2,
  );
}

function buildJobsInput(jobs: AdzunaJob[]): string {
  return JSON.stringify(
    jobs.map((job, index) => ({
      job_index: index,
      title: job.title,
      company: job.company,
      location: job.location,
      salary: job.salary,
      description: truncate(job.description, MAX_DESCRIPTION_CHARS),
    })),
    null,
    2,
  );
}

const PROMPT = [
  "Score each job below against the candidate profile. Call the record_matches tool exactly once.",
  "Rules:",
  "- Return ONE entry per job, for EVERY job, with job_index set to that job's index from the input. Never skip a job and never merge two.",
  "- match_score is an integer 0-100. Weigh required skills first, then seniority fit, then location and remote preference, then industry.",
  "- Job descriptions here are short snippets, not full postings. Score what is stated; do not assume unstated requirements.",
  "- match_reason is 2-3 sentences addressed to the candidate, naming the concrete reasons for the score. No preamble, no restating the number.",
  `- matched_skills lists skills FROM THE CANDIDATE'S OWN SKILLS LIST that this job asks for. At most ${MAX_SKILLS_PER_LIST}.`,
  `- missing_skills lists skills the job asks for that are NOT in the candidate's list. At most ${MAX_SKILLS_PER_LIST}.`,
  "- Never invent a skill, employer, or requirement that is not in the input. An empty list is correct when there is nothing to list.",
  "- Plain text only. No markdown.",
].join("\n");

/**
 * The scoring tool, with `minItems` pinned to this batch's job count.
 *
 * The gateway's constrained decoding ENFORCES `minItems` — measured: a tool
 * demanding at least 3 items, prompted for an empty list, still returned 3. So
 * the empty `{"matches":[]}` reply described at `MAX_SCORING_ATTEMPTS` becomes
 * unrepresentable rather than merely discouraged.
 *
 * Measured with it in place: 10 of 10 calls on the payload that had failed
 * scored 10/10 at the first attempt, indices 0-9 in order, no filler entries
 * (shortest reason 174 chars, no zero scores). Without it, 3 of 19 first
 * replies on that payload — 17 direct calls, 2 live searches — opened empty.
 *
 * Deliberately no matching `maxItems`: measured, a capped array does not stop
 * the model, it spills the remainder into a second parallel tool call — which
 * `requestScores` reads anyway, so the cap would buy nothing.
 */
function buildMatchingTool(jobCount: number) {
  return {
    type: "function" as const,
    function: {
      name: "record_matches",
      description: "Record one match assessment per job.",
      parameters: {
        type: "object",
        required: ["matches"],
        properties: {
          matches: {
            type: "array",
            minItems: jobCount,
            description: "One entry per input job, in the same order as the input.",
            items: {
              type: "object",
              required: ["job_index", "match_score", "match_reason"],
              properties: {
                job_index: {
                  type: "number",
                  description: "Zero-based index of the job in the input list.",
                },
                match_score: {
                  type: "number",
                  description: "Integer 0-100.",
                },
                match_reason: {
                  type: "string",
                  description: "2-3 sentences addressed to the candidate.",
                },
                matched_skills: {
                  type: "array",
                  maxItems: MAX_SKILLS_PER_LIST,
                  items: { type: "string" },
                },
                missing_skills: {
                  type: "array",
                  maxItems: MAX_SKILLS_PER_LIST,
                  items: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  };
}

/**
 * Model output is untrusted: every field optional and individually caught, so
 * one malformed entry drops instead of discarding the whole batch.
 */
const stringList = z
  .array(z.unknown())
  .transform((items) =>
    items.filter((item): item is string => typeof item === "string" && item.trim().length > 0),
  )
  .transform((items) => items.map((item) => item.trim()))
  .optional()
  .catch(undefined);

const matchEntrySchema = z
  .object({
    job_index: z.number().int().nonnegative().optional().catch(undefined),
    match_score: z.number().finite().optional().catch(undefined),
    match_reason: z.string().trim().min(1).optional().catch(undefined),
    matched_skills: stringList,
    missing_skills: stringList,
  })
  .catch({});

const matchesSchema = z.object({
  matches: z.array(matchEntrySchema).optional().catch(undefined),
});

/** One validated entry from the model, before it is placed by index. */
export type RawMatchEntry = z.infer<typeof matchEntrySchema>;

/**
 * Brings a model-produced number into the column's domain.
 *
 * `jobs.match_score` carries CHECK (match_score BETWEEN 0 AND 100) and all ten
 * rows are written as ONE insert, so a single out-of-range value would reject
 * the entire batch and turn a good search into a service error. The clamp is a
 * correctness requirement, not decoration. Rounding matters for the same
 * reason: the column is an integer.
 */
function toScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * Why `mapScoredMatches` discarded an entry. `noIndex` and `noScore` cover a
 * field that was present but unusable as well as one that was absent — the
 * schema's per-field `catch` makes those indistinguishable after validation,
 * which is why `describeEntry` reads the raw entry instead.
 */
export type DropReason = "noIndex" | "indexOutOfRange" | "duplicateIndex" | "noScore";

/** The placed scores, plus what was discarded and why. */
export type MatchPlacement = {
  /** Index-aligned with the jobs; `null` where nothing usable was returned. */
  results: (ScoredMatch | null)[];
  /** Discarded entries per reason. All zero on a clean response. */
  dropped: Record<DropReason, number>;
  /** Where in `entries` the first discard happened, or `null` if none did. */
  firstDrop: { position: number; reason: DropReason } | null;
};

/**
 * Places each model entry on the job it was produced for.
 *
 * Exported because this is where the two rules that protect the batch live, and
 * both are worth exercising directly: the score clamp (`toScore`) and the
 * index-based placement. Positional trust would be unsafe — a model that returns
 * seven entries for ten jobs would otherwise shift every later score onto the
 * wrong employer, and all ten rows would still render plausibly.
 *
 * Entries that are out of range, duplicated (first wins), or carry no score are
 * dropped rather than failing the batch: a null match is a recoverable outcome,
 * and there is nothing the user could do with the detail. The drops are
 * COUNTED, though — a response that loses every entry looks exactly like a
 * clean one otherwise, and the caller logs the tally.
 */
export function mapScoredMatches(
  entries: RawMatchEntry[],
  jobCount: number,
): MatchPlacement {
  const results = new Array<ScoredMatch | null>(jobCount).fill(null);
  const dropped: Record<DropReason, number> = {
    noIndex: 0,
    indexOutOfRange: 0,
    duplicateIndex: 0,
    noScore: 0,
  };
  let firstDrop: MatchPlacement["firstDrop"] = null;

  for (const [position, entry] of entries.entries()) {
    const drop = (reason: DropReason) => {
      dropped[reason] += 1;
      firstDrop ??= { position, reason };
    };
    const index = entry.job_index;

    if (index === undefined) {
      drop("noIndex");
      continue;
    }
    if (index >= jobCount) {
      drop("indexOutOfRange");
      continue;
    }
    if (results[index] !== null) {
      drop("duplicateIndex");
      continue;
    }
    if (entry.match_score === undefined) {
      drop("noScore");
      continue;
    }

    results[index] = {
      matchScore: toScore(entry.match_score),
      matchReason: entry.match_reason ?? "",
      matchedSkills: (entry.matched_skills ?? []).slice(0, MAX_SKILLS_PER_LIST),
      missingSkills: (entry.missing_skills ?? []).slice(0, MAX_SKILLS_PER_LIST),
    };
  }

  return { results, dropped, firstDrop };
}

/** A value's kind, never the value itself. "numeric string" is the telling one. */
function describeValue(value: unknown): string {
  if (value === undefined) {
    return "missing";
  }
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "non-finite number";
    }
    if (!Number.isInteger(value)) {
      return "fractional number";
    }
    return value < 0 ? "negative integer" : "integer";
  }
  if (typeof value === "string") {
    return /^\s*-?\d+(\.\d+)?\s*$/.test(value) ? "numeric string" : "string";
  }
  return typeof value;
}

/**
 * The shape of one raw model entry, safe to log: its type, its key names, and
 * the kind of value in the two fields placement depends on.
 *
 * Never a value. `match_reason` and the skill lists are written about the
 * candidate's profile, and the profile must not reach a log.
 */
function describeEntry(entry: unknown): Record<string, unknown> {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return { entry: describeValue(entry) };
  }
  const record = entry as Record<string, unknown>;
  return {
    entry: "object",
    // Names only, capped: a key is model-chosen text, so bound what it can carry.
    keys: Object.keys(record)
      .slice(0, 8)
      .map((key) => key.slice(0, 32)),
    jobIndex: describeValue(record.job_index),
    matchScore: describeValue(record.match_score),
  };
}

type AiClient = Awaited<ReturnType<typeof createAiClient>>;

/** What one gateway call produced, before placement. */
type ScoringReply = {
  /** Validated entries from every `record_matches` call, in order. */
  entries: RawMatchEntry[];
  /** The same entries as the model sent them, index-aligned, for `describeEntry`. */
  raw: unknown[];
  toolCalls: number;
  model: unknown;
  completionTokens: unknown;
};

/**
 * One scoring call. Never throws: `null` means the call produced nothing usable,
 * and the reason has already been logged.
 *
 * Reads EVERY tool call, not only the first. flash-lite has been measured
 * answering with two `record_matches` calls, the first of them
 * `{"matches":[]}` — read alone, that empty first call looks like a complete,
 * valid answer, and every listing saves unscored.
 */
async function requestScores(
  aiClient: AiClient,
  content: string,
  tool: ReturnType<typeof buildMatchingTool>,
): Promise<ScoringReply | null> {
  try {
    const completion = await aiClient.ai.chat.completions.create({
      model: MATCHING_MODEL,
      messages: [{ role: "user", content }],
      maxTokens: MATCHING_MAX_TOKENS,
      tools: [tool],
      // Safe to force, as in generation: the input is our own validated profile
      // plus listings we fetched, so there is no unreadable case to fabricate
      // around.
      toolChoice: "required",
    });

    const toolCalls: unknown = completion?.choices?.[0]?.message?.tool_calls;
    if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
      console.error("[agent/matcher] no tool call in completion");
      return null;
    }

    const entries: RawMatchEntry[] = [];
    const raw: unknown[] = [];
    let usableCalls = 0;

    for (const toolCall of toolCalls) {
      const rawArguments: unknown = toolCall?.function?.arguments;
      if (typeof rawArguments !== "string") {
        console.error("[agent/matcher] tool call carried no arguments");
        continue;
      }

      let parsedArguments: unknown;
      try {
        parsedArguments = JSON.parse(rawArguments);
      } catch {
        // The truncation case: output hit the token cap mid-JSON.
        console.error("[agent/matcher] tool arguments were not valid JSON");
        continue;
      }

      const validated = matchesSchema.safeParse(parsedArguments);
      if (!validated.success || validated.data.matches === undefined) {
        console.error("[agent/matcher] schema rejected the scoring response");
        continue;
      }

      usableCalls += 1;
      entries.push(...validated.data.matches);
      // Same length as the validated list: every element passes `matchEntrySchema`
      // (it catches to `{}`), and `matches` is only defined when this is an array.
      raw.push(...(parsedArguments as { matches: unknown[] }).matches);
    }

    if (usableCalls === 0) {
      return null;
    }

    return {
      entries,
      raw,
      toolCalls: toolCalls.length,
      model: completion?.model,
      // The gateway reports usage in camelCase, not OpenAI's snake_case.
      completionTokens: completion?.usage?.completionTokens,
    };
  } catch (error) {
    console.error("[agent/matcher] scoring failed", error);
    return null;
  }
}

/**
 * Scores every job against the profile in one gateway call — two when the first
 * reply leaves any job unscored (see `MAX_SCORING_ATTEMPTS`).
 *
 * Returns an array INDEX-ALIGNED with `jobs`; `null` means the model returned
 * nothing usable for that job. Never throws, and never discards the whole batch
 * for one bad entry — a job that fails to score is still worth saving, and the
 * caller writes null match fields for it.
 */
export async function scoreJobs(
  profile: Profile,
  jobs: AdzunaJob[],
): Promise<(ScoredMatch | null)[]> {
  let results = new Array<ScoredMatch | null>(jobs.length).fill(null);

  if (jobs.length === 0) {
    return results;
  }

  let aiClient: AiClient;
  try {
    aiClient = await createAiClient();
  } catch (error) {
    console.error("[agent/matcher] scoring failed", error);
    return results;
  }

  const content = `${PROMPT}\n\nCANDIDATE PROFILE:\n${buildProfileInput(
    profile,
  )}\n\nJOBS:\n${buildJobsInput(jobs)}`;
  const tool = buildMatchingTool(jobs.length);

  let attempts = 0;
  while (attempts < MAX_SCORING_ATTEMPTS) {
    attempts += 1;
    const startedAt = Date.now();
    const reply = await requestScores(aiClient, content, tool);

    if (reply !== null) {
      const placement = mapScoredMatches(reply.entries, jobs.length);
      // An earlier attempt's score wins; a retry only fills what is still empty.
      results = results.map((match, index) => match ?? placement.results[index]);

      const placed = placement.results.filter((match) => match !== null).length;
      // Counts and shapes only, never values — see `describeEntry`. Enough to
      // tell an empty reply from a malformed one without reproducing the call.
      const details = {
        attempt: attempts,
        model: reply.model,
        completionTokens: reply.completionTokens,
        toolCalls: reply.toolCalls,
        entries: reply.entries.length,
        placed,
        dropped: placement.dropped,
        firstDrop:
          placement.firstDrop === null
            ? null
            : {
                reason: placement.firstDrop.reason,
                ...describeEntry(reply.raw[placement.firstDrop.position]),
              },
      };
      if (placed < jobs.length) {
        console.error("[agent/matcher] reply left jobs unscored", details);
      } else if (placement.firstDrop !== null) {
        // Every job placed, so whatever dropped was surplus — commonly a stray
        // eleventh entry at index 10. Harmless, but it costs output tokens.
        console.log("[agent/matcher] reply had surplus entries", details);
      }
    }

    const complete = results.every((match) => match !== null);
    if (complete || Date.now() - startedAt > RETRY_WINDOW_MS) {
      break;
    }
  }

  const scored = results.filter((match) => match !== null).length;
  console.log(
    "[agent/matcher] scored",
    scored,
    "of",
    jobs.length,
    "listings in",
    attempts,
    attempts === 1 ? "call" : "calls",
  );
  return results;
}
