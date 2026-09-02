"use client";

import { useState } from "react";
import { Building2, SearchX } from "lucide-react";
import { JobFilters } from "@/components/find-jobs/JobFilters";
import { JobsPagination } from "@/components/find-jobs/JobsPagination";
import { formatRelativeDate, HIGH_MATCH_THRESHOLD } from "@/lib/utils";
import type { Job, JobSort, MatchFilter } from "@/types";

/** Feature 11 raises this to 20, alongside server-side querying. */
const PAGE_SIZE = 6;

/** Lower bound of the warning colour band. Below it, a score reads as muted. */
const MID_MATCH_THRESHOLD = 50;

const TH_CLASS =
  "px-6 py-4 text-left text-xs font-medium uppercase tracking-wide text-text-secondary";
// `text-left` is explicit because the first cell of each row is a `<th>`, which
// the UA stylesheet centres. Today a flex child masks that; plain text in the
// cell would silently centre while every other column stayed left.
const TD_CLASS = "px-6 py-4 text-left text-sm text-text-primary";

/**
 * A missing score sorts and filters as 0 — a job nothing has scored is not a
 * match. The column renders it as an em dash rather than "0%", which would read
 * as a measured result.
 */
function scoreOf(job: Job): number {
  return job.match_score ?? 0;
}

/** Case-insensitive substring match on either company or role. */
function matchesQuery(job: Job, needle: string): boolean {
  if (needle === "") return true;
  const company = job.company?.toLowerCase() ?? "";
  const title = job.title?.toLowerCase() ?? "";
  return company.includes(needle) || title.includes(needle);
}

function matchesBand(job: Job, filter: MatchFilter): boolean {
  if (filter === "all") return true;
  const score = scoreOf(job);
  return filter === "high"
    ? score >= HIGH_MATCH_THRESHOLD
    : score < HIGH_MATCH_THRESHOLD;
}

/**
 * Filter and order the list.
 *
 * Kept as plain functions over an array so Feature 11 can move the same rules
 * into a `jobs` query without reshaping the components around them.
 */
function selectJobs(
  jobs: Job[],
  query: string,
  matchFilter: MatchFilter,
  sort: JobSort,
): Job[] {
  const needle = query.trim().toLowerCase();
  const filtered = jobs.filter(
    (job) => matchesQuery(job, needle) && matchesBand(job, matchFilter),
  );

  return [...filtered].sort((a, b) => {
    if (sort === "score") return scoreOf(b) - scoreOf(a);
    const aFound = new Date(a.found_at).getTime();
    const bFound = new Date(b.found_at).getTime();
    return sort === "newest" ? bFound - aFound : aFound - bFound;
  });
}

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

type Props = {
  jobs: Job[];
};

/**
 * The job list: filter bar, table, and pagination.
 *
 * This component owns the list's view state. `JobFilters` and `JobsPagination`
 * are presentational, and all three read one derived list, so exactly one owner
 * is possible. It lives here rather than in a fifth wrapper component because
 * `context/architecture.md` fixes this directory at four files.
 *
 * Rows show a hover state but are deliberately not links: `/find-jobs/[id]` is
 * Feature 12, and a control that leads to a missing page is worse than none.
 */
export function JobsTable({ jobs }: Props) {
  const [query, setQuery] = useState("");
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("all");
  const [sort, setSort] = useState<JobSort>("score");
  const [page, setPage] = useState(1);

  const visible = selectJobs(jobs, query, matchFilter, sort);
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  // Clamped rather than trusted: every control that narrows the list resets the
  // page below, but a clamp means no combination can render a blank page.
  const currentPage = Math.min(page, totalPages);
  const rangeStart = (currentPage - 1) * PAGE_SIZE;
  const rows = visible.slice(rangeStart, rangeStart + PAGE_SIZE);

  const hasActiveFilters = query.trim() !== "" || matchFilter !== "all";

  // Narrowing the list returns to page 1. Without this, a user on page 4 who
  // types a filter would be looking at a page that no longer exists.
  function changeQuery(value: string) {
    setQuery(value);
    setPage(1);
  }

  function changeMatchFilter(value: MatchFilter) {
    setMatchFilter(value);
    setPage(1);
  }

  function changeSort(value: JobSort) {
    setSort(value);
    setPage(1);
  }

  function clearFilters() {
    setQuery("");
    setMatchFilter("all");
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6">
      <JobFilters
        query={query}
        onQueryChange={changeQuery}
        matchFilter={matchFilter}
        onMatchFilterChange={changeMatchFilter}
        sort={sort}
        onSortChange={changeSort}
      />

      <section className="bg-surface border border-border rounded-2xl shadow-card">
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
              {/*
                FEATURE 10: this copy assumes filters are what emptied the list.
                Once `jobs` comes from the database, a user's first-ever visit
                arrives here with no jobs and no filters, and "no jobs match the
                current filters" explains nothing. Split it then: an unfiltered
                empty list needs "run your first search", not "clear filters".
              */}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <SearchX
                      className="mx-auto h-6 w-6 text-text-muted"
                      aria-hidden="true"
                    />
                    <p className="mt-3 text-sm text-text-muted">
                      No jobs match the current filters.
                    </p>
                    {hasActiveFilters ? (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-4 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary focus:outline-none focus:ring-1 focus:ring-accent"
                      >
                        Clear filters
                      </button>
                    ) : null}
                  </td>
                </tr>
              ) : (
                rows.map((job) => (
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
                    <td className={`${TD_CLASS} text-text-secondary`}>
                      {formatRelativeDate(job.found_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {visible.length > 0 ? (
          <JobsPagination
            page={currentPage}
            totalPages={totalPages}
            totalResults={visible.length}
            rangeStart={rangeStart + 1}
            rangeEnd={rangeStart + rows.length}
            onPageChange={setPage}
          />
        ) : null}
      </section>
    </div>
  );
}
