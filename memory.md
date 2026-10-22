# Memory — Job deduplication

Last updated: 2026-10-22

## What was built

A search no longer saves or re-scores a listing the user already has. OpenSpec
change `add-job-deduplication`: proposed, applied, reviewed and archived to
`openspec/changes/archive/2026-10-22-add-job-deduplication/` on 2026-10-22. Its
deltas added 1 requirement and modified 7 across `openspec/specs/job-discovery/`
and `openspec/specs/find-jobs/`. The decision record is in
`context/progress-tracker.md` under "Job deduplication".

- **New:** `db/migrations/005_add_jobs_external_id.sql`. It is **applied to the
  dev DB**: `jobs.external_id`, `UNIQUE (user_id, external_id)`, and a CHECK
  requiring an id on search rows.
- **Modified:** `agent/adzuna.ts` (reads Adzuna's `id`, dedupes by it, drops
  listings with no id), `app/api/agent/find/route.ts` (lookup, then score the new
  and unscored, conflict-ignore insert, guarded fill-in), `types/index.ts`
  (`FindActionResult.newJobs`), `components/find-jobs/SearchControls.tsx`
  ("Found 10 jobs, 3 new, 1 strong match." and the all-saved notice).
- **Docs:** `architecture.md`, `library-docs.md` (new Deduplication section, and
  the stale Adzuna mapping lines fixed), `build-plan.md`, `ui-registry.md`,
  `progress-tracker.md`.

## Decisions made

All recorded in the tracker and the archived design (D1–D10). The ones that would
hurt to undo by accident:

- **The key is Adzuna's `id`, not title + company and not `redirect_url`.**
  Probed: it is stable across requests and over a month, and it is the redirect
  URL's path. US, UK and AU ids share one global range.
- **Never go back to a plain `insert([...])` for search results.** With the
  constraint in place it is atomic, so one known row fails the whole batch. Use
  `upsert(…, { onConflict: "user_id,external_id", ignoreDuplicates: true })`,
  which was probed on InsForge although its docs omit it, and count only the
  rows it returns.
- **The unique constraint must stay non-partial.** `on_conflict` cannot target a
  partial index.
- **A saved job is never re-scored or changed. The one exception is a row with a
  null score**, filled in by an update guarded by `match_score IS NULL`. That guard
  is the only thing preventing an overwrite; don't drop it.
- **`jobsFound` now means "listings found"; `newJobs` means "rows inserted".**
  `agent_runs.jobs_found` means jobs that run newly saved.

## Problems solved

- **Adzuna returns 503 to concurrent requests on one key**, even for two
  different queries. A same-tick race test never reaches the DB. Stagger the
  second request about 1.5 s so it enters while the first is still scoring.
- **A literal timestamp in a PostHog HogQL query is read in the project's
  timezone** and silently cuts events out. Use `now() - INTERVAL …`.
- **A node script doing string replacement on the CRLF `context/` docs matched
  only one-line patterns**, leaving mixed line endings. Use the Edit tool on
  those files.
- The auto-mode classifier refuses unplanned writes, and sometimes reads, through
  `run-raw-sql`. Writes the developer approved in chat went through.

## Current state

- Lint, `tsc`, build, `check:agents`, `check:sync`, and `openspec validate --all
  --strict` (3 specs) all pass.
- Verified live with row counts before and after each step:
  - all-saved search: no `/chat/completion`, no rows changed;
  - mixed search: 5 new, 5 scored, 5 events;
  - staggered race: one search saved the rows, the other reported 0 new;
  - fill-in of a blanked row: scored after a gateway 429 and a retry, with its
    date and run unchanged;
  - migration re-run is a no-op (rolled-back dry run).
- Dev DB: 15 jobs, all scored, no seed rows. The backup table was dropped.
  Avoca AI (`5889071313`) now scores 75 (it was 50; it was blanked for the
  fill-in test).
- Committed with this memory file. Nothing deployed.

## Next session starts with

Feature 12, the Job Details Page: `/opsx-propose`. Settle the `missing_skills`
question below first, because Feature 12 renders those lists.

## Open questions

- **Adzuna concurrency (503) is a production problem**: two users searching at the
  same moment means one sees "Job search is unavailable". The likely fix is a
  retry with jitter in `agent/adzuna.ts`. It's a task of its own, not started.
- **Searches only read Adzuna's first page**, so repeating a query mostly says
  "all already in your list". Fetching later pages is a product decision.
- **`missing_skills` can contradict the profile**: one reply listed React and
  TypeScript as missing for a candidate who has both. Not benchmarked.
- Next fetches bare `/find-jobs` twice per navigation. Harmless; cause unknown.
- The status region is verified in the DOM, not with NVDA/VoiceOver. The 300 ms
  debounce is unmeasured. `?page=1e20` falls back to page 1.
- Carried over from Feature 10:
  - `location_searched` records "Remote" as typed;
  - an empty `match_reason` is stored as `''`;
  - only four Adzuna markets are searched;
  - Feature 13 has no model path for Stagehand (do not reintroduce
    `OPENAI_API_KEY`);
  - `agent_logs` has no writer;
  - `ai_usage` retention is unhandled;
  - Feature 06 leftovers: save-success copy, resume input reset, tag input clear;
  - `maxDuration = 120` is unverified against the hosting plan.

## Testing notes

- **Sign in first.** Signing in is the developer's job; never automate it.
- **The pane runs "hidden"**: `setTimeout` throttles to about 1 s. Space scripted
  keystrokes with a `MessageChannel` wait.
- **SQL oracle technique**: hash the expected order in SQL
  (`encode(sha256(convert_to(string_agg(…), 'UTF8')), 'hex')`), and compare it with
  the rendered rows. `position(lower(needle) in lower(col))` is a wildcard-free
  contains check.
- **Rolled-back dry runs**: in a `do $$ … $$` block, run the statement, collect
  counts, and `raise exception` with them. The error carries the result and rolls
  everything back, including DDL such as dropping a constraint to plant
  duplicates.
- **Hash the rows you claim are untouched**, as `external_id|score|found_at|run_id`,
  before and after.
- **Adzuna probes** from a scratchpad script (keys read from `.env.local`, never
  printed) cost quota but no `ai_usage` slot. Benchmark scoring through the gateway
  directly with the SDK's `createClient` to avoid spending searches.
- PostHog ingestion lags 10–30 s. Wait for the search's `job_search_started`
  before concluding a `job_found` is absent.
- Node 26 runs `.ts` directly. For the `@/` alias, register a resolve hook
  (`module.register`). There is no `tsx` in the repo.
- The scratchpad is wiped between sessions. Check that a harness's expected case
  count actually ran.
- Carried over: reset viewport emulation before trusting a click; never print
  `.env.local` values; `assets/CV …pdf` is the uncommitted extraction fixture;
  never click Save Profile while testing.
