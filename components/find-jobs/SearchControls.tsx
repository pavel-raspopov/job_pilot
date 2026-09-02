"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles } from "lucide-react";

import type { FindActionResult } from "@/types";

const INPUT_CLASS =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent disabled:bg-surface-secondary disabled:text-text-muted disabled:cursor-not-allowed";

const LABEL_CLASS =
  "mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-secondary";

const NOTICE_CLASS =
  "mt-4 rounded-md border border-border bg-surface-secondary px-3 py-2 text-sm text-text-primary";

const EMPTY_TITLE_ERROR = "Enter a job title to search.";
const SERVICE_ERROR = "Could not run the search. Please try again.";
const SEARCHING_MESSAGE =
  "Searching for jobs and scoring them against your profile. This can take up to a minute.";
/**
 * Names the supported markets on purpose. An unrecognised country falls back to
 * a United States search, so "Berlin, Germany" returns nothing — and telling
 * that user to "try a broader location" sends them down a path that cannot
 * work, because Germany is not searchable at all.
 */
const NO_RESULTS_MESSAGE =
  "No jobs found for that search. JobPilot searches the US, UK, Canada, and Australia — try a different job title, or a location in one of those.";

type SearchState =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "success"; jobsFound: number; strongMatches: number }
  | { status: "error"; message: string };

/**
 * Job search form and its result summary.
 *
 * The counts come from the search's own response, not from the rows on screen.
 * Feature 09 passed them as props precisely so the banner could not contradict
 * the list; that reasoning inverts once the table holds history, because a user
 * with 24 saved jobs whose search finds 3 must be told 3, and `jobs.length`
 * would say 27. The banner describes the run, not the table.
 *
 * This is a billed action, so the in-flight guard is a `useRef` and not just a
 * `disabled` attribute — `setState` lands a render later, so two clicks in one
 * tick both read the old value and both fire. That was measured: one double
 * click, two POSTs, two billed calls.
 */
export function SearchControls() {
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const searchingRef = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const searching = state.status === "searching";

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    // Synchronous, so a second activation in the same tick cannot get past it.
    if (searchingRef.current) {
      return;
    }

    // Read the form BEFORE any await: `event.currentTarget` is null once the
    // native dispatch has finished, so reading it later throws.
    const formData = new FormData(event.currentTarget);
    const jobTitle = String(formData.get("jobTitle") ?? "").trim();
    const location = String(formData.get("location") ?? "").trim();

    if (jobTitle === "") {
      setState({ status: "error", message: EMPTY_TITLE_ERROR });
      titleRef.current?.focus();
      // The ref is deliberately still unset: a refused submit is not in flight.
      return;
    }

    searchingRef.current = true;
    setState({ status: "searching" });
    // `job_search_started` is fired SERVER-side, in `POST /api/agent/find`, and
    // deliberately not here. Only the server knows whether the search survived
    // the rate-limit check, and a search refused for an exhausted allowance did
    // not start — counting it here would inflate the top of the funnel and
    // double-count every search that did run.

    try {
      const response = await fetch("/api/agent/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle, location }),
      });
      const result = (await response.json()) as FindActionResult;

      if (!result.success) {
        // The server owns this wording — a rate limit or an incomplete profile
        // needs its own message, and inventing one here would contradict it.
        setState({ status: "error", message: result.error ?? SERVICE_ERROR });
        return;
      }

      setState({
        status: "success",
        jobsFound: result.jobsFound ?? 0,
        strongMatches: result.strongMatches ?? 0,
      });

      // Re-runs the server tree and reconciles into the existing React tree, so
      // the banner stays up and the table's filter, sort and page survive.
      router.refresh();
    } catch {
      setState({ status: "error", message: SERVICE_ERROR });
    } finally {
      searchingRef.current = false;
    }
  }

  return (
    <section className="bg-surface border border-border rounded-2xl p-6 shadow-card">
      <h2 className="sr-only">Search for jobs</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
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
              ref={titleRef}
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
          disabled={searching}
          className="flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          {searching ? "Searching…" : "Find Jobs"}
        </button>
      </form>

      {/*
        Always mounted, so the polite region exists before its content does —
        the reliably-announced case. The wrapper is unstyled and carries no
        margin, so an empty region contributes nothing to layout.
      */}
      <div role="status">
        {searching ? <p className={NOTICE_CLASS}>{SEARCHING_MESSAGE}</p> : null}

        {state.status === "success" && state.jobsFound === 0 ? (
          <p className={NOTICE_CLASS}>{NO_RESULTS_MESSAGE}</p>
        ) : null}

        {state.status === "success" && state.jobsFound > 0 ? (
          <p className="mt-4 flex items-center gap-2 rounded-md border border-success-light bg-success-lightest px-3 py-2 text-sm text-success-foreground">
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
            Found {state.jobsFound} {state.jobsFound === 1 ? "job" : "jobs"} and saved{" "}
            {state.strongMatches} strong{" "}
            {state.strongMatches === 1 ? "match" : "matches"}.
          </p>
        ) : null}
      </div>

      {/*
        Assertive, and outside the status region: "your search did not run" is
        not a polite update, and nesting it would demote it.
      */}
      {state.status === "error" ? (
        <p role="alert" className="mt-4 text-sm text-error">
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
