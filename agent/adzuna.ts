import { z } from "zod";

import { serverEnv } from "@/lib/env";

/**
 * Adzuna job discovery.
 *
 * Owns everything provider-shaped: URL construction, country inference, salary
 * formatting, and response validation. Callers get a normalised result, so no
 * Adzuna field naming reaches the route.
 *
 * **Nothing here throws.** Every failure is returned as a value, because the
 * route needs to tell a provider outage apart from an internal fault, and a
 * `catch` block several frames up has already lost that distinction.
 */

/** The Adzuna markets this app searches. The code sits in the request path. */
export type AdzunaCountry = "us" | "gb" | "ca" | "au";

/** One Adzuna listing, normalised. */
export type AdzunaJob = {
  title: string;
  company: string | null;
  location: string | null;
  /** Already formatted for display, e.g. "$120k - $160k". Null when unusable. */
  salary: string | null;
  /** Adzuna returns a snippet, not a full posting. Becomes `jobs.about_role`. */
  description: string;
  /** Adzuna tracking URL. Becomes `jobs.external_apply_url`. */
  redirectUrl: string;
};

export type AdzunaSearchResult =
  | { success: true; jobs: AdzunaJob[] }
  | { success: false; error: string };

const ADZUNA_BASE_URL = "https://api.adzuna.com/v1/api/jobs";

/** Matches the batch the matcher scores in one call. */
const RESULTS_PER_PAGE = 10;

/**
 * Adzuna normally answers in well under a second. The route's 120s budget
 * belongs to the model call, not to a hung upstream.
 */
const ADZUNA_TIMEOUT_MS = 10_000;

/**
 * Below this a figure is an hourly or daily rate rather than an annual one, and
 * rendering it as "0k" would be a lie.
 */
const MIN_ANNUAL_SALARY = 1_000;

const DEFAULT_COUNTRY: AdzunaCountry = "us";

/**
 * Country names and unambiguous abbreviations only — never cities, and never
 * regional codes.
 *
 * "San Francisco, CA" is California, not Canada. "Indianapolis, IN" is Indiana,
 * not India. "London, ON" is Ontario. A city or state list looks helpful and is
 * a source of silently-wrong countries, whose only symptom is an empty result
 * set the user cannot explain.
 */
const COUNTRY_BY_ALIAS: ReadonlyMap<string, AdzunaCountry> = new Map([
  ["united kingdom", "gb"],
  ["great britain", "gb"],
  ["uk", "gb"],
  ["gb", "gb"],
  ["england", "gb"],
  ["scotland", "gb"],
  ["wales", "gb"],
  ["northern ireland", "gb"],
  ["canada", "ca"],
  ["australia", "au"],
  ["united states", "us"],
  ["united states of america", "us"],
  ["usa", "us"],
  ["us", "us"],
  ["u.s.", "us"],
  ["u.s.a.", "us"],
  ["america", "us"],
]);

/**
 * "Remote" is a working arrangement, not an Adzuna place. Sent as `where` it
 * matches almost nothing, so a perfectly good query returns an empty search.
 * Omitted, the search covers the whole country — which is what was meant. The
 * location field's own placeholder text invites the word.
 */
const NON_PLACES: ReadonlySet<string> = new Set(["remote", "anywhere", "any"]);

const CURRENCY_SYMBOL: Record<AdzunaCountry, string> = {
  us: "$",
  gb: "£",
  ca: "CA$",
  au: "A$",
};

/**
 * Name and message only — never the error object.
 *
 * `console.error(error)` prints the whole chain, and a fetch failure's `cause`
 * can carry the request URL, which carries the app key. The credentials must not
 * reach a log by that or any other route.
 */
function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

/**
 * Infers the Adzuna market from free-text location.
 *
 * Segments are scanned right to left because a location names its country last:
 * "Austin, Texas, USA". Anything unrecognised falls back to the default market.
 */
export function detectCountry(location: string): AdzunaCountry {
  const segments = location
    .toLowerCase()
    .split(",")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const match = COUNTRY_BY_ALIAS.get(segments[index]);
    if (match !== undefined) {
      return match;
    }
  }

  return DEFAULT_COUNTRY;
}

/** The place to narrow to, or null when the text names no searchable place. */
function toPlace(location: string): string | null {
  const trimmed = location.trim();
  if (trimmed.length === 0 || NON_PLACES.has(trimmed.toLowerCase())) {
    return null;
  }
  return trimmed;
}

/**
 * Formats a salary range for the list's "Salary est." column.
 *
 * Handles a min without a max, which the documented snippet in
 * `context/library-docs.md` does not — it reads `salary_max!` while guarding
 * only on `salary_min`, and throws on the many listings that carry one figure.
 *
 * No "(estimated)" suffix: the column header already says it.
 */
export function formatSalary(
  min: number | null,
  max: number | null,
  country: AdzunaCountry,
): string | null {
  const symbol = CURRENCY_SYMBOL[country];
  const usable = (value: number | null): value is number =>
    typeof value === "number" && Number.isFinite(value) && value >= MIN_ANNUAL_SALARY;

  const thousands = (value: number) => `${symbol}${Math.round(value / 1000)}k`;

  const low = usable(min) ? min : null;
  const high = usable(max) ? max : null;

  if (low !== null && high !== null) {
    return low === high ? thousands(low) : `${thousands(low)} - ${thousands(high)}`;
  }
  if (low !== null) {
    return thousands(low);
  }
  if (high !== null) {
    return thousands(high);
  }
  return null;
}

/**
 * Provider output is untrusted input, so it is validated like model output:
 * every field optional and individually caught, so one malformed listing drops
 * instead of failing the whole search.
 */
const displayName = z
  .object({ display_name: z.string().trim().min(1).optional().catch(undefined) })
  .optional()
  .catch(undefined);

const adzunaResultSchema = z
  .object({
    title: z.string().trim().min(1).optional().catch(undefined),
    redirect_url: z.string().trim().min(1).optional().catch(undefined),
    description: z.string().optional().catch(undefined),
    company: displayName,
    location: displayName,
    salary_min: z.number().finite().optional().catch(undefined),
    salary_max: z.number().finite().optional().catch(undefined),
  })
  .catch({});

const adzunaResponseSchema = z.object({
  results: z.array(adzunaResultSchema).optional().catch(undefined),
});

type ValidatedResult = z.infer<typeof adzunaResultSchema>;

function normalise(results: ValidatedResult[], country: AdzunaCountry): AdzunaJob[] {
  const seen = new Set<string>();
  const jobs: AdzunaJob[] = [];

  for (const result of results) {
    const title = result.title;
    const redirectUrl = result.redirect_url;

    // Nothing to show, or nowhere to apply. Either way the row would be dead.
    if (title === undefined || redirectUrl === undefined) {
      continue;
    }
    if (seen.has(redirectUrl)) {
      continue;
    }
    seen.add(redirectUrl);

    jobs.push({
      title,
      company: result.company?.display_name ?? null,
      location: result.location?.display_name ?? null,
      salary: formatSalary(result.salary_min ?? null, result.salary_max ?? null, country),
      description: result.description?.trim() ?? "",
      redirectUrl,
    });

    if (jobs.length >= RESULTS_PER_PAGE) {
      break;
    }
  }

  return jobs;
}

/**
 * Searches Adzuna for IT listings matching a title and, where given, a place.
 *
 * `error` is an internal string for the server log — never shown to a user. The
 * route maps every failure onto one user-facing message.
 */
export async function searchJobs(
  jobTitle: string,
  location: string,
): Promise<AdzunaSearchResult> {
  const country = detectCountry(location);

  try {
    const { ADZUNA_APP_ID, ADZUNA_APP_KEY } = serverEnv();

    const params = new URLSearchParams({
      app_id: ADZUNA_APP_ID,
      app_key: ADZUNA_APP_KEY,
      what: jobTitle,
      // Product invariant: JobPilot only searches IT roles. Never omit this.
      category: "it-jobs",
      results_per_page: String(RESULTS_PER_PAGE),
      "content-type": "application/json",
    });

    const place = toPlace(location);
    if (place !== null) {
      params.set("where", place);
    }

    // `no-store` is explicit: Next 16 does not cache fetch by default, but a
    // job search must never be served from a cache under a future default.
    const response = await fetch(`${ADZUNA_BASE_URL}/${country}/search/1?${params}`, {
      signal: AbortSignal.timeout(ADZUNA_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      // Country and status only — never the key, never the full URL.
      console.error("[agent/adzuna] provider returned", response.status, "for", country);
      return { success: false, error: `adzuna http ${response.status}` };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      console.error("[agent/adzuna] response was not json:", describeError(error));
      return { success: false, error: "adzuna malformed json" };
    }

    const validated = adzunaResponseSchema.safeParse(payload);
    if (!validated.success || validated.data.results === undefined) {
      console.error("[agent/adzuna] response shape was unusable for", country);
      return { success: false, error: "adzuna malformed response" };
    }

    const jobs = normalise(validated.data.results, country);
    console.log("[agent/adzuna]", country, "returned", jobs.length, "usable listings");
    return { success: true, jobs };
  } catch (error) {
    // Covers a missing credential (serverEnv throws), a network failure, and the
    // abort timeout. All are "the provider is unavailable" from here.
    console.error("[agent/adzuna] request failed for", country, "-", describeError(error));
    return { success: false, error: "adzuna request failed" };
  }
}
