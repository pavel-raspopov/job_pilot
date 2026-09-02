"use client";

import { useState } from "react";
import { Search, Sparkles } from "lucide-react";

const INPUT_CLASS =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent disabled:bg-surface-secondary disabled:text-text-muted disabled:cursor-not-allowed";

const LABEL_CLASS =
  "mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-secondary";

type Props = {
  /** Rows currently in the list — reported by the summary after a search. */
  jobsFound: number;
  /** How many of those clear the High Match threshold. */
  strongMatches: number;
};

/**
 * Job search form and its result summary.
 *
 * Feature 09 runs no search: the button reveals the summary and nothing else.
 * Feature 10 replaces `searched` with the result of `POST /api/agent/find` and
 * fires `job_search_started`. At that point this becomes a billed action and
 * needs an in-flight `useRef` guard, not just a `disabled` attribute — see the
 * "Routes that call the AI gateway" section of `context/code-standards.md`.
 */
export function SearchControls({ jobsFound, strongMatches }: Props) {
  const [searched, setSearched] = useState(false);

  return (
    <section className="bg-surface border border-border rounded-2xl p-6 shadow-card">
      <h2 className="sr-only">Search for jobs</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSearched(true);
        }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label htmlFor="job-title" className={LABEL_CLASS}>
            Job title
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <input
              id="job-title"
              name="jobTitle"
              type="text"
              placeholder="Frontend Engineer"
              className={`${INPUT_CLASS} pl-9`}
            />
          </div>
        </div>

        <div className="flex-1">
          <label htmlFor="location" className={LABEL_CLASS}>
            Location
          </label>
          <input
            id="location"
            name="location"
            type="text"
            placeholder="Remote, New York..."
            className={INPUT_CLASS}
          />
        </div>

        <button
          type="submit"
          className="flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          Find Jobs
        </button>
      </form>

      {searched ? (
        <p
          role="status"
          className="mt-4 flex items-center gap-2 rounded-md border border-success-light bg-success-lightest px-3 py-2 text-sm text-success-foreground"
        >
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
          Found {jobsFound} jobs and saved {strongMatches} strong matches.
        </p>
      ) : null}
    </section>
  );
}
