import { ChevronDown, Search } from "lucide-react";
import type { JobSort, MatchFilter } from "@/types";

const INPUT_CLASS =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent";

const MATCH_OPTIONS: { value: MatchFilter; label: string }[] = [
  { value: "all", label: "All Matches" },
  { value: "high", label: "High Match" },
  { value: "low", label: "Low Match" },
];

const SORT_OPTIONS: { value: JobSort; label: string }[] = [
  { value: "score", label: "Match Score" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  matchFilter: MatchFilter;
  onMatchFilterChange: (value: MatchFilter) => void;
  sort: JobSort;
  onSortChange: (value: JobSort) => void;
};

/**
 * Filter bar above the job list.
 *
 * Presentational only — props in, callbacks out. `JobsTable` owns the state
 * these controls read and write.
 *
 * The card uses `p-4` rather than the standard `p-6`: it is a single row of
 * controls with no field labels, and `p-6` makes it taller than the design.
 */
export function JobFilters({
  query,
  onQueryChange,
  matchFilter,
  onMatchFilterChange,
  sort,
  onSortChange,
}: Props) {
  return (
    <section className="bg-surface border border-border rounded-2xl p-4 shadow-card">
      <h2 className="sr-only">Filter and sort jobs</h2>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <label htmlFor="job-filter-query" className="sr-only">
            Filter by company or role
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <input
            id="job-filter-query"
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Filter by company or role..."
            className={`${INPUT_CLASS} pl-9`}
          />
        </div>

        <div className="flex gap-3 sm:border-l sm:border-border sm:pl-3">
          <div className="relative">
            <label htmlFor="job-filter-match" className="sr-only">
              Match filter
            </label>
            <select
              id="job-filter-match"
              value={matchFilter}
              onChange={(event) =>
                onMatchFilterChange(event.target.value as MatchFilter)
              }
              className={`${INPUT_CLASS} cursor-pointer appearance-none pr-9`}
            >
              {MATCH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
          </div>

          <div className="relative">
            <label htmlFor="job-filter-sort" className="sr-only">
              Sort by
            </label>
            <select
              id="job-filter-sort"
              value={sort}
              onChange={(event) => onSortChange(event.target.value as JobSort)}
              className={`${INPUT_CLASS} cursor-pointer appearance-none pr-9`}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
