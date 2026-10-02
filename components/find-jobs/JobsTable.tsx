"use client";

import { useEffect, useRef, useState, useTransition, type FocusEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Building2, CircleAlert, Search, SearchX } from "lucide-react";
import { JobFilters } from "@/components/find-jobs/JobFilters";
import { JobsPagination } from "@/components/find-jobs/JobsPagination";
import { jobListHref, normalizeQuery } from "@/lib/job-list-params";
import { formatRelativeDate, HIGH_MATCH_THRESHOLD } from "@/lib/utils";
import type { Job, JobListParams, JobSort, MatchFilter } from "@/types";

/**
 * How long typing must pause before the filter text reaches the URL. Chosen,
 * not measured — the repo had no precedent. Revisit if typing feels laggy or
 * the network panel shows a request per keystroke.
 */
const QUERY_DEBOUNCE_MS = 300;

function sameView(a: JobListParams, b: JobListParams): boolean {
  return a.q === b.q && a.match === b.match && a.sort === b.sort && a.page === b.page;
}

/** Lower bound of the warning colour band. Below it, a score reads as muted. */
const MID_MATCH_THRESHOLD = 50;

const TH_CLASS =
  "px-6 py-4 text-left text-xs font-medium uppercase tracking-wide text-text-secondary";
// `text-left` is explicit because the first cell of each row is a `<th>`, which
// the UA stylesheet centres. Today a flex child masks that; plain text in the
// cell would silently centre while every other column stayed left.
const TD_BASE_CLASS = "px-6 py-4 text-left text-sm";
const TD_CLASS = `${TD_BASE_CLASS} text-text-primary`;
// Its own string rather than `${TD_CLASS} text-text-secondary`: two text
// colours on one element resolve by stylesheet order, not class order (see the
// Variant Class Standard in `context/ui-registry.md`).
const TD_MUTED_CLASS = `${TD_BASE_CLASS} text-text-secondary`;

/**
 * Fill colour by score band.
 *
 * The success boundary is `HIGH_MATCH_THRESHOLD`, the same constant the High
 * Match filter uses, so a green bar is exactly a row that filter keeps. The
 * binding design asset paints some bars blue; `context/ui-tokens.md` and
 * `context/ui-rules.md` both say green from 70, and that conflict was resolved
 * in favour of the tokens on 2026-07-31. No blue appears here.
 */
function scoreBandClass(score: number): string {
  if (score >= HIGH_MATCH_THRESHOLD) return "bg-success";
  if (score >= MID_MATCH_THRESHOLD) return "bg-warning";
  return "bg-text-muted";
}

function MatchScoreCell({ job }: { job: Job }) {
  if (job.match_score === null) {
    return (
      <span
        className="text-sm text-text-muted"
        aria-label="Match score not available"
      >
        &mdash;
      </span>
    );
  }

  const score = job.match_score;

  return (
    <div className="flex items-center gap-3">
      {/*
        The bar is decorative to assistive technology: the percentage beside it
        already announces the value, so labelling the bar too would read the
        score twice per row. The score is therefore never conveyed by colour
        alone — it is conveyed by the text.
      */}
      <div
        className="h-1 w-24 shrink-0 overflow-hidden rounded-full bg-border-light"
        aria-hidden="true"
      >
        <div
          className={`h-full rounded-full ${scoreBandClass(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-sm font-medium text-text-primary">{score}%</span>
    </div>
  );
}

function SourceBadge({ source }: { source: Job["source"] }) {
  const isSearch = source === "search";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        isSearch
          ? "bg-accent-muted text-accent"
          : "bg-surface-secondary text-text-secondary"
      }`}
    >
      {isSearch ? "Search" : "URL"}
    </span>
  );
}

/**
 * Why the list is empty. The remedies differ, so the copy has to.
 *
 * The cause is decided by `page.tsx`, which is the only place that can: this
 * component holds one page of rows, never the account's whole list. The server
 * answers "does this user have saved jobs at all?" as `hasAnyJobs` — free in
 * every case but one, where it costs a single probe query — and `no-matches` is
 * reached only when that is true and nothing matched. A user with no saved jobs
 * who types in the filter box therefore gets "run a search", not a Clear button
 * that would produce nothing.
 */
type EmptyVariant = "load-failed" | "no-jobs" | "no-matches";

const EMPTY_COPY: Record<EmptyVariant, string> = {
  "load-failed": "Could not load your jobs. This is usually temporary.",
  "no-jobs": "No jobs yet. Run a search above to find jobs matched to your profile.",
  "no-matches": "No jobs match the current filters.",
};

const SECONDARY_BUTTON_CLASS =
  "mt-4 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary focus:outline-none focus:ring-1 focus:ring-accent";

/**
 * Local and unexported, like `MatchScoreCell` and `SourceBadge` above — the
 * four-file limit on this directory is about exported components.
 *
 * `no-jobs` gets a plain `Search` icon rather than `SearchX`: the user has not
 * searched yet, so an X over a magnifier asserts a failed search that never
 * happened. It also gets no button, because the control it would point at is
 * one card above and in view; the copy names the location instead.
 */
function EmptyState({
  variant,
  onClear,
  onRetry,
}: {
  variant: EmptyVariant;
  onClear: () => void;
  onRetry: () => void;
}) {
  const Icon = variant === "load-failed" ? CircleAlert : variant === "no-jobs" ? Search : SearchX;

  return (
    <>
      <Icon
        className={`mx-auto h-6 w-6 ${
          variant === "load-failed" ? "text-error" : "text-text-muted"
        }`}
        aria-hidden="true"
      />
      <p className="mt-3 text-sm text-text-muted">{EMPTY_COPY[variant]}</p>
      {variant === "no-matches" ? (
        <button type="button" onClick={onClear} className={SECONDARY_BUTTON_CLASS}>
          Clear filters
        </button>
      ) : null}
      {variant === "load-failed" ? (
        <button type="button" onClick={onRetry} className={SECONDARY_BUTTON_CLASS}>
          Try again
        </button>
      ) : null}
    </>
  );
}

type Props = {
  /** One page of rows, already filtered and ordered by the database. */
  jobs: Job[];
  /** The view those rows describe, with `page` clamped to the last page. */
  params: JobListParams;
  /** Jobs matching the current filters, across every page. */
  totalCount: number;
  totalPages: number;
  /** 1-based index of the first visible row; 0 when there are none. */
  rangeStart: number;
  /** 1-based index of the last visible row; 0 when there are none. */
  rangeEnd: number;
  /** Whether the user has any saved jobs at all, whatever the filters. */
  hasAnyJobs: boolean;
  /**
   * The `jobs` select failed. Empty for a reason no search or filter change
   * fixes, so it must not be reported as "you have no jobs yet".
   */
  loadFailed: boolean;
};

/**
 * The job list: filter bar, table, and pagination.
 *
 * The rows, the total and the range arrive as facts from `page.tsx`, which
 * runs the query; this component derives none of them. What it owns is the
 * URL: it is the only writer of `q` / `match` / `sort` / `page`, and every
 * control changes the list by navigating, never by holding a copy of the
 * view. It lives here rather than in a fifth wrapper component because
 * `context/architecture.md` fixes this directory at four files.
 *
 * Typing uses `replace` — one history entry per keystroke burst would make
 * Back useless — while the band, the sort, the page and Clear use `push`,
 * because each is one deliberate act that Back should undo.
 *
 * Rows show a hover state but are deliberately not links: `/find-jobs/[id]` is
 * Feature 12, and a control that leads to a missing page is worse than none.
 */
export function JobsTable({
  jobs,
  params,
  totalCount,
  totalPages,
  rangeStart,
  rangeEnd,
  hasAnyJobs,
  loadFailed,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // The text box shows a local draft, so typing never waits on a round trip.
  const [queryDraft, setQueryDraft] = useState(params.q);
  // The view this component last asked for. Props trail it while a navigation
  // is in flight, so every handler builds on this rather than on props: a band
  // change made inside the debounce window keeps the newest text, and a second
  // change made before the first lands keeps the first. State rather than a
  // ref because the resync below reads it during render.
  const [intended, setIntended] = useState(params);
  // Typed text is waiting on the debounce to reach the URL.
  const [queryWaiting, setQueryWaiting] = useState(false);
  // The armed debounce and the href it will send, so a blur can send it early.
  const debounce = useRef<{ timer: ReturnType<typeof setTimeout>; href: string } | null>(
    null,
  );

  // Back, Forward, or the server clamping a page past the end moved the URL
  // somewhere this component did not send it: adopt it. Only when nothing of
  // ours is in flight, though — after our own navigation lands the props can
  // trail text typed since, and adopting them then would delete it. React's
  // "adjust state when a prop changes" pattern, not an effect.
  if (!queryWaiting && !isPending && !sameView(params, intended)) {
    setIntended(params);
    if (params.q !== intended.q) setQueryDraft(params.q);
  }

  useEffect(() => {
    // Back or Forward inside the debounce window abandons the typed text. Left
    // armed, the timer would `replace` the history entry the user just moved to
    // with the view they moved away from.
    function abandonPendingQuery() {
      if (debounce.current === null) return;
      clearTimeout(debounce.current.timer);
      debounce.current = null;
      setQueryWaiting(false);
    }

    window.addEventListener("popstate", abandonPendingQuery);
    return () => {
      window.removeEventListener("popstate", abandonPendingQuery);
      if (debounce.current !== null) clearTimeout(debounce.current.timer);
    };
  }, []);

  // Precedence matters: a load failure must not be reported as an empty account,
  // and an account with no jobs must not be told to clear filters it never set.
  const emptyVariant: EmptyVariant = loadFailed
    ? "load-failed"
    : hasAnyJobs
      ? "no-matches"
      : "no-jobs";

  function go(next: JobListParams) {
    setIntended(next);
    startTransition(() => {
      router.push(jobListHref(pathname, next), { scroll: false });
    });
  }

  function sendQuery(href: string) {
    startTransition(() => {
      // Cleared inside the transition so it commits together with the new
      // rows. Cleared outside it, there could be a render where neither guard
      // on the resync holds while the props still trail the text.
      setQueryWaiting(false);
      router.replace(href, { scroll: false });
    });
  }

  // Every control but typing carries the newest text itself, so a debounce
  // still waiting to send it would only re-send it.
  function cancelPendingQuery() {
    if (debounce.current !== null) {
      clearTimeout(debounce.current.timer);
      debounce.current = null;
    }
    setQueryWaiting(false);
  }

  // Typed text still waiting on the debounce goes out the moment the filter
  // box loses focus. Otherwise a navbar link clicked inside the window is lost:
  // the link starts navigating, the timer then fires its `replace`, and Next
  // abandons a pending navigation for a newer one, so the user stays here.
  // Clicking a link moves focus on mousedown, so sent on blur ours is the older
  // navigation and the link's wins.
  function flushOnFilterBlur(event: FocusEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== "search") return;

    const pending = debounce.current;
    if (pending === null) return;
    clearTimeout(pending.timer);
    debounce.current = null;
    sendQuery(pending.href);
  }

  // Changing the filter, the band or the sort returns to page 1. Without that,
  // a user on page 4 who narrows the list would land on a page that no longer
  // exists — the server would clamp it, but to the last page, not the first.
  function changeQuery(value: string) {
    setQueryDraft(value);

    const q = normalizeQuery(value);
    // Whitespace at the ends, or typing past the limit, changes nothing the
    // URL would hold. Any debounce already waiting still carries the text.
    if (q === intended.q) return;

    const next = { ...intended, q, page: 1 };
    setIntended(next);
    setQueryWaiting(true);

    if (debounce.current !== null) clearTimeout(debounce.current.timer);
    const href = jobListHref(pathname, next);
    debounce.current = {
      href,
      timer: setTimeout(() => {
        debounce.current = null;
        sendQuery(href);
      }, QUERY_DEBOUNCE_MS),
    };
  }

  function changeMatchFilter(value: MatchFilter) {
    cancelPendingQuery();
    go({ ...intended, match: value, page: 1 });
  }

  function changeSort(value: JobSort) {
    cancelPendingQuery();
    go({ ...intended, sort: value, page: 1 });
  }

  function changePage(page: number) {
    // The current page's own button. Navigating would re-run the same query
    // and dim the table for nothing.
    if (page === intended.page) return;
    cancelPendingQuery();
    go({ ...intended, page });
  }

  // Resets the text and the band, keeps the sort — the sort cannot be why the
  // list is empty, and the user chose it.
  function clearFilters() {
    cancelPendingQuery();
    setQueryDraft("");
    go({ ...intended, q: "", match: "all", page: 1 });
  }

  return (
    <div className="flex flex-col gap-6" onBlur={flushOnFilterBlur}>
      <JobFilters
        query={queryDraft}
        onQueryChange={changeQuery}
        matchFilter={intended.match}
        onMatchFilterChange={changeMatchFilter}
        sort={intended.sort}
        onSortChange={changeSort}
      />

      {/*
        While a navigation is in flight the current rows stay on screen, dimmed,
        rather than being swapped for a skeleton: they are still correct data
        until the new rows land. `opacity-60` is this project's existing "not
        actionable right now" signal (`disabled:opacity-60` on every button).

        `aria-busy` alone announces nothing: it asks assistive technology to
        hold back changes inside the section until it clears. The updating
        state is spoken by the polite region below instead, which sits OUTSIDE
        the busy section — inside, it would be held back too — and stays mounted
        so a change to its text is announced. `sr-only` takes it out of flow,
        so it adds no gap to the column.
      */}
      <p role="status" className="sr-only">
        {isPending ? "Updating results…" : ""}
      </p>
      <section
        aria-busy={isPending}
        className={`bg-surface border border-border rounded-2xl shadow-card transition-opacity ${
          isPending ? "opacity-60" : ""
        }`}
      >
        <h2 className="sr-only">Jobs found</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <caption className="sr-only">
              Jobs found, with match score, salary estimate, source and date
              found
            </caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className={TH_CLASS}>
                  Company
                </th>
                <th scope="col" className={TH_CLASS}>
                  Role
                </th>
                <th scope="col" className={TH_CLASS}>
                  Match score
                </th>
                <th scope="col" className={TH_CLASS}>
                  Salary est.
                </th>
                <th scope="col" className={TH_CLASS}>
                  Source
                </th>
                <th scope="col" className={TH_CLASS}>
                  Date found
                </th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <EmptyState
                      variant={emptyVariant}
                      onClear={clearFilters}
                      onRetry={() => router.refresh()}
                    />
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="border-b border-border transition-colors last:border-b-0 hover:bg-surface-secondary"
                  >
                    <th scope="row" className={`${TD_CLASS} font-semibold`}>
                      <span className="flex items-center gap-3">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-secondary"
                          aria-hidden="true"
                        >
                          <Building2 className="h-4 w-4 text-text-muted" />
                        </span>
                        {job.company}
                      </span>
                    </th>
                    <td className={TD_CLASS}>{job.title}</td>
                    <td className={TD_CLASS}>
                      <MatchScoreCell job={job} />
                    </td>
                    <td className={TD_CLASS}>{job.salary}</td>
                    <td className={TD_CLASS}>
                      <SourceBadge source={job.source} />
                    </td>
                    <td className={TD_MUTED_CLASS}>
                      {formatRelativeDate(job.found_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {jobs.length > 0 ? (
          <JobsPagination
            page={params.page}
            totalPages={totalPages}
            totalResults={totalCount}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onPageChange={changePage}
            disabled={isPending}
          />
        ) : null}
      </section>

      {/*
        Provider attribution, required by `context/project-overview.md` ("Jobs by
        Adzuna credit displayed on job listings") and a standard condition of the
        Adzuna API terms. Shown whenever this user has saved listings at all —
        not gated on the current filter or page — so narrowing the list cannot
        drop the credit off the page. `jobs` is one page and may be empty under a
        filter, so the account-level `hasAnyJobs` decides, not its length.
      */}
      {hasAnyJobs ? (
        <p className="text-xs text-text-muted">Jobs by Adzuna</p>
      ) : null}
    </div>
  );
}
