import { z } from "zod";

import { createAiClient } from "@/lib/insforge-ai";
import type { Profile } from "@/types";

import type { AdzunaJob } from "@/agent/adzuna";

/**
 * Scores discovered listings against the user's profile.
 *
 * One batched gateway call covers the whole page of results: ten separate calls
 * would cost roughly ten times as much for reasoning the list does not yet show.
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
 */
const MATCHING_MODEL = "google/gemini-2.5-flash-lite";

/**
 * Caps output, the dominant cost driver. Ten entries of one short paragraph plus
 * two brief skill lists runs ~1,000 tokens; this leaves roughly 3x headroom.
 *
 * Truncation breaks the tool-call JSON, which degrades to an unscored batch —
 * the jobs still save — rather than to a half-written set of scores.
 */
const MATCHING_MAX_TOKENS = 3072;

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

const MATCHING_TOOL = {
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
 * Places each model entry on the job it was produced for.
 *
 * Exported because this is where the two rules that protect the batch live, and
 * both are worth exercising directly: the score clamp (`toScore`) and the
 * index-based placement. Positional trust would be unsafe — a model that returns
 * seven entries for ten jobs would otherwise shift every later score onto the
 * wrong employer, and all ten rows would still render plausibly.
 *
 * Entries that are out of range, duplicated (first wins), or carry no score are
 * dropped silently: a null match is a recoverable outcome, and there is nothing
 * the user could do with the detail.
 */
export function mapScoredMatches(
  entries: RawMatchEntry[],
  jobCount: number,
): (ScoredMatch | null)[] {
  const results = new Array<ScoredMatch | null>(jobCount).fill(null);

  for (const entry of entries) {
    const index = entry.job_index;

    if (index === undefined || index >= jobCount || results[index] !== null) {
      continue;
    }
    if (entry.match_score === undefined) {
      continue;
    }

    results[index] = {
      matchScore: toScore(entry.match_score),
      matchReason: entry.match_reason ?? "",
      matchedSkills: (entry.matched_skills ?? []).slice(0, MAX_SKILLS_PER_LIST),
      missingSkills: (entry.missing_skills ?? []).slice(0, MAX_SKILLS_PER_LIST),
    };
  }

  return results;
}

/**
 * Scores every job against the profile in ONE gateway call.
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
  const unscored = (): (ScoredMatch | null)[] => new Array<ScoredMatch | null>(jobs.length).fill(null);

  if (jobs.length === 0) {
    return [];
  }

  try {
    const aiClient = await createAiClient();
    const completion = await aiClient.ai.chat.completions.create({
      model: MATCHING_MODEL,
      messages: [
        {
          role: "user",
          content: `${PROMPT}\n\nCANDIDATE PROFILE:\n${buildProfileInput(
            profile,
          )}\n\nJOBS:\n${buildJobsInput(jobs)}`,
        },
      ],
      maxTokens: MATCHING_MAX_TOKENS,
      tools: [MATCHING_TOOL],
      // Safe to force, as in generation: the input is our own validated profile
      // plus listings we fetched, so there is no unreadable case to fabricate
      // around.
      toolChoice: "required",
    });

    const rawArguments =
      completion?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;

    if (typeof rawArguments !== "string") {
      console.error("[agent/matcher] no tool call in completion");
      return unscored();
    }

    let parsedArguments: unknown;
    try {
      parsedArguments = JSON.parse(rawArguments);
    } catch {
      // The truncation case: output hit the token cap mid-JSON.
      console.error("[agent/matcher] tool arguments were not valid JSON");
      return unscored();
    }

    const validated = matchesSchema.safeParse(parsedArguments);
    if (!validated.success || validated.data.matches === undefined) {
      console.error("[agent/matcher] schema rejected the scoring response");
      return unscored();
    }

    const results = mapScoredMatches(validated.data.matches, jobs.length);

    const scored = results.filter((match) => match !== null).length;
    console.log("[agent/matcher] scored", scored, "of", jobs.length, "listings");
    return results;
  } catch (error) {
    console.error("[agent/matcher] scoring failed", error);
    return unscored();
  }
}
