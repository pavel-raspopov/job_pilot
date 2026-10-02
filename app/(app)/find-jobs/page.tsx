import { JobsTable } from "@/components/find-jobs/JobsTable";
import { SearchControls } from "@/components/find-jobs/SearchControls";
import { createInsforgeServer } from "@/lib/insforge-server";
import {
  hasActiveFilters,
  parseJobListParams,
  type RawSearchParams,
} from "@/lib/job-list-params";
import { parseJobRow } from "@/lib/parse-job";
import { HIGH_MATCH_THRESHOLD } from "@/lib/utils";
import type { Job, JobListParams } from "@/types";

type InsforgeServerClient = Awaited<ReturnType<typeof createInsforgeServer>>;

/**
 * Jobs per page.
 *
 * Read only in this file — by `loadJobsPage` for `.range()`, and by the page
 * for the clamp and for the range the footer states. The client is handed
 * `totalPages`, `rangeStart` and `rangeEnd` as facts rather than the page
 * size, so "twenty" is encoded in exactly one place. That is why those three
 * props exist.
 */
const PAGE_SIZE = 20;

/**
 * Build a `%contains%` ILIKE pattern from the user's filter text, safe to
 * interpolate into a PostgREST `or=(…)` string.
 *
 * There are two parsers between this string and the SQL predicate, and both
 * have metacharacters, so there are two escape layers — applied in this order:
 *
 *   1. **SQL LIKE.** `%` and `_` are wildcards and `\` is the escape character,
 *      so each gets a leading backslash.
 *   2. **PostgREST's quoted-value syntax.** The value is wrapped in double
 *      quotes below (which is what protects a `,` `.` `:` `(` `)` in the user's
 *      text from being read as filter structure), and inside those quotes `"`
 *      and `\` are backslash-escaped. Every backslash produced by step 1 is
 *      therefore doubled here.
 *
 * The surrounding `%` are added last, so they stay wildcards instead of being
 * escaped along with the user's text.
 *
 * Getting this wrong is not a security hole: the `or=(…)` group is ANDed with
 * `user_id=eq.<id>` and gated again by RLS, so the worst case is a 400 that the
 * page reports as "Could not load your jobs" — which a user filtering on
 * "Smith, Jones" would otherwise hit on every keystroke.
 *
 * `*` is deliberately NOT escaped, because it cannot be: PostgREST rewrites
 * every `*` in a like/ilike pattern to `%` before Postgres sees it. An asterisk
 * in the filter box is therefore a wildcard, which is the one input where this
 * filter cannot reproduce the client-side `String.includes` it replaced. It
 * widens the user's own filter and can never reach another user's rows.
 */
function containsPattern(needle: string): string {
  const likeSafe = needle.replace(/[\\%_]/g, (char) => `\\${char}`);
  const quoteSafe = likeSafe.replace(/["\\]/g, (char) => `\\${char}`);
  return `%${quoteSafe}%`;
}

type JobsPage = {
  jobs: Job[];
  /** Filtered total, from `content-range`. Null means the header was absent. */
  total: number | null;
  failed: boolean;
  /**
   * The requested page starts past the last row. Not a failure: PostgREST
   * answers such an offset with 416 (PGRST103) rather than an empty page, and
   * `postgrest-js` reads `count` only from a successful response — so the
   * total is unknown too, and the caller has to ask for it.
   */
  outOfRange: boolean;
};

/**
 * One page of the signed-in user's saved jobs, filtered and ordered as asked.
 *
 * A function rather than an inline chain because it is called twice: once for
 * the requested page, and again if that page turned out to be past the end.
 */
async function loadJobsPage(
  insforge: InsforgeServerClient,
  userId: string,
  params: JobListParams,
): Promise<JobsPage> {
  const from = (params.page - 1) * PAGE_SIZE;

  // `select("*")` stays. Narrowing to the six rendered columns looks like an
  // easy win and has a landmine: `parseJobRow` returns null unless `id`,
  // `user_id`, `source` and `found_at` are all present, so a select that
  // omitted `user_id` would parse EVERY row to null and render an empty table
  // with no error anywhere. It would also manufacture `Job` objects whose
  // unfetched columns read as null when the row has values.
  let query = insforge.database
    .from("jobs")
    .select("*", { count: "exact" })
    .eq("user_id", userId);

  // Every clause that needs OR goes into ONE `or=` parameter, nested under an
  // `and(…)`. Two `.or()` calls would emit `or=(…)&or=(…)`, which PostgREST
  // itself ANDs — but the InsForge records endpoint does not forward a repeated
  // key intact, and "text filter + Low Match" failed with PGRST100 on every
  // request. One key has no repeated-key semantics to depend on.
  const orGroups: string[] = [];

  if (params.q !== "") {
    const pattern = containsPattern(params.q);
    orGroups.push(`or(company.ilike."${pattern}",title.ilike."${pattern}")`);
  }

  if (params.match === "high") {
    // Nothing needed for unscored rows: `NULL >= 70` is NULL, so they drop out
    // on their own — which is what `(match_score ?? 0) >= 70` did too.
    query = query.gte("match_score", HIGH_MATCH_THRESHOLD);
  } else if (params.match === "low") {
    // `.lt()` alone would DROP unscored jobs. The client coerced null to 0 and
    // put them here, and the two bands have to partition the list: Feature 10
    // degrades a failed scoring run to saved-but-unscored rows, and a user
    // filtering by band must not find those missing from both bands.
    orGroups.push(`or(match_score.lt.${HIGH_MATCH_THRESHOLD},match_score.is.null)`);
  }

  if (orGroups.length > 0) {
    query = query.or(`and(${orGroups.join(",")})`);
  }

  if (params.sort === "score") {
    query = query
      // Postgres defaults DESC to NULLS FIRST. The client sorted a missing
      // score as 0, so unscored jobs came last; this reproduces that.
      .order("match_score", { ascending: false, nullsFirst: false })
      // The client relied on `Array.prototype.sort` being stable over an array
      // that arrived `found_at desc`, so equal scores came out newest-first.
      // SQL has no implicit tiebreak; this is that rule made explicit.
      .order("found_at", { ascending: false })
      .order("id", { ascending: false });
  } else {
    const ascending = params.sort === "oldest";
    query = query
      .order("found_at", { ascending })
      // Not decoration. Every row of one search batch shares an identical
      // `found_at` (the column defaults to now(), which is transaction time),
      // so ties are the normal case — and `offset`/`limit` over a partial order
      // can return a row on page 2 that already appeared on page 1, or skip one
      // entirely, with nothing on either page looking wrong. `id` is the only
      // unique key available, so it terminates every ordering.
      //
      // Consequence worth knowing: with `id` appended, neither
      // `jobs_user_found_at_idx` nor `jobs_user_match_score_idx` supplies the
      // whole ordering — Postgres sorts within ties. Irrelevant at tens of rows
      // per user, but the index is not doing the ordering.
      .order("id", { ascending });
  }

  const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);

  if (error?.code === "PGRST103") {
    return { jobs: [], total: null, failed: false, outOfRange: true };
  }

  if (error) {
    console.error("[find-jobs/page] could not load jobs", error);
    return { jobs: [], total: null, failed: true, outOfRange: false };
  }

  const jobs = Array.isArray(data)
    ? data
        .map((row: unknown) => parseJobRow(row))
        .filter((job): job is Job => job !== null)
    : [];

  // Not reached today: the count was verified to arrive. If the header is ever
  // stripped, the fallback total is one page of rows, so the footer
  // under-reports AND every page past the first is clamped back to page 1.
  if (count === null && jobs.length > 0) {
    console.error(
      "[find-jobs/page] rows returned with no count — the total and paging are wrong",
    );
  }

  return { jobs, total: count, failed: false, outOfRange: false };
}

/**
 * Whether the user has any saved jobs at all, whatever the view.
 *
 * Asked only in the one branch the filtered result cannot answer: filters are
 * active and nothing matched. With no filters the filtered total IS the account
 * total, and a non-zero total answers it outright. The question is a boolean,
 * so this selects one id rather than asking for a count — a count would depend
 * on the `content-range` header again, for what is itself an edge case.
 *
 * A failed probe answers `true`. We only get here with filters active, so "no
 * jobs match the current filters" is true either way and offering to clear
 * them is never nonsense. Answering `false` could tell a user with forty saved
 * jobs to run their first search, and would drop the provider credit.
 */
async function accountHasJobs(
  insforge: InsforgeServerClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await insforge.database
    .from("jobs")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  if (error) {
    console.error("[find-jobs/page] could not check for saved jobs", error);
    return true;
  }

  return Array.isArray(data) && data.length > 0;
}

/**
 * The signed-in user's saved jobs, filtered, ordered and paginated by the
 * database.
 *
 * The four view values live in `searchParams`, not in component state, so a
 * filtered view can be linked, bookmarked and restored by reloading — and so
 * `SearchControls`' `router.refresh()` re-runs the identical query and leaves
 * the user where they were after a search.
 *
 * Only one page of rows is ever fetched. The footer's total comes back with
 * those rows from the same filtered query, so the "of N results" it states and
 * the rows on screen cannot disagree — which is what a `.limit()` over the old
 * fetch-everything query could never have guaranteed.
 *
 * A query failure is passed down as `loadFailed` rather than falling through as
 * an empty list — an empty list would tell a user with forty saved jobs to run
 * their first search.
 */
export default async function FindJobsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = parseJobListParams(await searchParams);

  const insforge = await createInsforgeServer();
  const { data, error: authError } = await insforge.auth.getCurrentUser();
  const userId = data?.user?.id ?? null;

  let jobs: Job[] = [];
  let totalCount = 0;
  let page = params.page;
  let hasAnyJobs = false;
  let loadFailed = false;

  if (authError || userId === null) {
    // `proxy.ts` already redirects a request with no session, so reaching this
    // render without a user means the session read broke. That is a load
    // failure, not an account with no jobs.
    loadFailed = true;
  } else {
    let result = await loadJobsPage(insforge, userId, params);

    // A page past the end — a hand-edited URL, a stale bookmark, or Back after a
    // narrowing filter — shows the last page instead of an empty table. Clamped
    // and re-queried rather than redirected: the page is only known to be out
    // of range after a completed query, so a redirect would cost a whole second
    // render, auth read included, where this costs a query or two in the rare
    // case.
    //
    // Usually the first query cannot even say where the end is: PostgREST
    // refuses an offset past the last row outright, with no count. Page 1
    // always exists — offset 0 is satisfiable over zero rows — so it is asked
    // next, and its count names the last page.
    if (result.outOfRange) {
      page = 1;
      result = await loadJobsPage(insforge, userId, { ...params, page });
    }

    // `total` is null only if `content-range` went missing; `loadJobsPage` logs
    // it. Falling back to the row count under-reports, where treating it as 0
    // would print "of 0 results" beside twenty visible rows.
    let total = result.total ?? result.jobs.length;

    // Not redundant with the branch above: an offset landing EXACTLY on the
    // total is not a 416. PostgREST answers it 200, empty, with the count —
    // measured with `?q=engineer&page=3` over 40 matches. This clamp is what
    // turns that into the last page.
    const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const target = Math.min(params.page, lastPage);
    if (target !== page && !result.failed) {
      page = target;
      result = await loadJobsPage(insforge, userId, { ...params, page });
      total = result.total ?? result.jobs.length;
    }

    jobs = result.jobs;
    totalCount = total;
    loadFailed = result.failed;

    // No filters: the filtered total is the account total. Filters active and
    // rows found: the visible rows are a subset of the account's. Only filters
    // active with nothing found is ambiguous, and only that costs a query.
    if (!loadFailed) {
      hasAnyJobs =
        total > 0 ||
        (hasActiveFilters(params) && (await accountHasJobs(insforge, userId)));
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rangeStart = jobs.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = jobs.length === 0 ? 0 : rangeStart + jobs.length - 1;

  return (
    <div className="mx-auto max-w-[1440px] px-8 py-8">
      <h1 className="sr-only">Find Jobs</h1>
      <div className="flex flex-col gap-6">
        <SearchControls />
        <JobsTable
          jobs={jobs}
          // Built from the clamped page, so the range, `aria-current` and every
          // href the list generates describe the page actually shown.
          params={{ ...params, page }}
          totalCount={totalCount}
          totalPages={totalPages}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          hasAnyJobs={hasAnyJobs}
          loadFailed={loadFailed}
        />
      </div>
    </div>
  );
}
