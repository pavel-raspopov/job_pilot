import { z } from "zod";

import type { JobListParams, JobSort, MatchFilter } from "@/types";

/**
 * The Find Jobs list's URL contract — both directions of it.
 *
 * `context/architecture.md` forbids a `lib/` module built for a single caller;
 * that rule is why `agent/types.ts` and `ResumePreview.tsx` were left unbuilt.
 * This module has two callers, and they are the two halves of one contract:
 * `app/(app)/find-jobs/page.tsx` parses the URL, and
 * `components/find-jobs/JobsTable.tsx` writes it. Keeping them apart would put
 * the parameter names and their defaults in two files, free to drift — the
 * defect the Phase 2 review found in `renderableRoles`, where a model's output
 * was keyed by position into a list two functions computed differently.
 *
 * Every value here is untrusted request input: a user can hand-edit the address
 * bar, follow a stale bookmark, or arrive from a link written by an older build.
 * So nothing throws. A value that is absent, empty, unrecognised or out of range
 * falls back to its default, which is what `.catch()` states per field.
 */

const MATCH_FILTER_VALUES = ["all", "high", "low"] as const satisfies readonly MatchFilter[];
const SORT_VALUES = ["score", "newest", "oldest"] as const satisfies readonly JobSort[];

/**
 * Matches the find route's own `z.string().trim().max(100)` on `jobTitle`.
 *
 * Over-length text is **truncated rather than rejected**: dropping the filter
 * entirely would silently widen the list, and a user who pasted something long
 * would be shown more jobs than they asked for, not fewer.
 */
export const MAX_QUERY_LENGTH = 100;

/**
 * A ceiling on `page` at parse time, so `(page - 1) * PAGE_SIZE` can never
 * leave safe-integer range no matter what the address bar says. The real bound
 * is the count-derived clamp in `page.tsx`; this one only keeps the arithmetic
 * honest before the count is known.
 *
 * A larger page is clamped to this ceiling, not thrown away: `?page=10001` is
 * still "a page past the end", which shows the last page. Falling back to page
 * 1 would make it the one page number with different behaviour from its
 * neighbours.
 */
const MAX_PAGE = 10_000;

/**
 * The filter text as the URL will hold it.
 *
 * Exported because `JobsTable` must predict what the server will parse out of
 * the href it writes. If it compared its own raw text against the parsed
 * value, a pause after typing "senior " would bring back `q=senior`, look like
 * an outside change, and delete the space the user is about to follow with
 * "dev".
 *
 * That comparison only works if normalising twice changes nothing, which is
 * why the cut is followed by a second trim — a cut landing just after a space
 * would otherwise leave one that the server's own parse then strips. The cut
 * counts code points, not UTF-16 units, so it can never split an emoji into a
 * lone surrogate that the URL turns into U+FFFD.
 */
export function normalizeQuery(value: string): string {
  return Array.from(value.trim()).slice(0, MAX_QUERY_LENGTH).join("").trimEnd();
}

/** The unfiltered, unsorted-by-default, first-page view. */
export const DEFAULT_JOB_LIST_PARAMS: JobListParams = {
  q: "",
  match: "all",
  sort: "score",
  page: 1,
};

const paramsSchema = z.object({
  q: z.string().catch("").transform(normalizeQuery),
  match: z.enum(MATCH_FILTER_VALUES).catch(DEFAULT_JOB_LIST_PARAMS.match),
  sort: z.enum(SORT_VALUES).catch(DEFAULT_JOB_LIST_PARAMS.sort),
  page: z.coerce
    .number()
    .int()
    .min(1)
    .catch(DEFAULT_JOB_LIST_PARAMS.page)
    .transform((page) => Math.min(page, MAX_PAGE)),
});

/** What Next hands a page as `searchParams` once awaited. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

/**
 * A repeated parameter (`?q=a&q=b`) arrives as an array. Take the first value
 * rather than rejecting it — the request is answerable, and refusing to render
 * a page over a duplicated query string would be a worse outcome than picking
 * one.
 */
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseJobListParams(searchParams: RawSearchParams): JobListParams {
  const parsed = paramsSchema.safeParse({
    q: firstValue(searchParams.q),
    match: firstValue(searchParams.match),
    sort: firstValue(searchParams.sort),
    page: firstValue(searchParams.page),
  });

  // Unreachable while every field carries `.catch()`, but the fallback is one
  // line and the alternative is an unhandled throw during a server render.
  return parsed.success ? parsed.data : { ...DEFAULT_JOB_LIST_PARAMS };
}

/**
 * The inverse of `parseJobListParams`.
 *
 * Only non-default values are written, which is what makes `/find-jobs` the
 * canonical zero state and lets "are any filters active?" be decided from the
 * parsed params alone. Unknown parameters are deliberately dropped rather than
 * carried through, so nothing user-controlled is reflected back into a link.
 */
export function jobListHref(pathname: string, params: JobListParams): string {
  const search = new URLSearchParams();

  if (params.q !== "") search.set("q", params.q);
  if (params.match !== DEFAULT_JOB_LIST_PARAMS.match) search.set("match", params.match);
  if (params.sort !== DEFAULT_JOB_LIST_PARAMS.sort) search.set("sort", params.sort);
  if (params.page > 1) search.set("page", String(params.page));

  const query = search.toString();
  return query === "" ? pathname : `${pathname}?${query}`;
}

/**
 * Whether the current view narrows the list.
 *
 * The sort is excluded on purpose: reordering the list cannot empty it, so it
 * can never be the reason a user is looking at no rows. `page.tsx` uses this to
 * tell "you have no saved jobs" apart from "your filters matched none of them".
 */
export function hasActiveFilters(params: JobListParams): boolean {
  return params.q !== "" || params.match !== DEFAULT_JOB_LIST_PARAMS.match;
}
