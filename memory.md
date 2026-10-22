# Memory — Adzuna 503 retry

Last updated: 2026-10-22

## What was built

A momentary Adzuna 503 no longer fails a user's search. OpenSpec change
`retry-adzuna-unavailable`: proposed, applied, reviewed and archived to
`openspec/changes/archive/2026-10-22-retry-adzuna-unavailable/` on 2026-10-22. Its
delta modified one `job-discovery` requirement ("Failures are reported without
discarding usable results") with three new scenarios. The decision record is in
`context/progress-tracker.md` under "Adzuna 503 retry".

- **Modified:** `agent/adzuna.ts` only. `searchJobs()` loops the fetch and retries
  on 503 alone. It makes at most 3 attempts, waiting 300–600 ms and then 600–1200 ms,
  jittered. One `AbortSignal` and deadline cover all attempts, and it skips a retry
  when under 2.5 s would remain. The refused body is cancelled, and a failed cancel
  is logged. The internal error is now `adzuna http <status> after <n> attempt(s)`.
- **Unchanged on purpose:** the route, the rate limiter and the UI. A persistent
  503 still fails the run with no slot charged.
- **Docs:** `library-docs.md` (two Adzuna rules: retry 503, never 429) and
  `progress-tracker.md` (new entry; the dedup entry's 503 note is re-diagnosed).

## Decisions made

- **Retry 503 only. Never 429** (the shared per-minute quota). Never other 5xx,
  timeouts or network errors (none was seen to recover).
- **The 10 s budget is per search, not per attempt.** Don't give each attempt its
  own `AbortSignal.timeout`.

## Problems solved

- **Adzuna's 503 is burst load-shedding, not a concurrency limit.** This corrects
  the last session's note. Eight concurrent pairs and triples returned 200. Four
  503s (about 0.7 s each) and a 429 came only during a burst of about 15 requests
  in 30 s. Neither status carries `Retry-After`. **A concurrent pair proves nothing
  about the retry.**
- **Stubbing a provider under `next dev` without touching app code**: a scratchpad
  ESM preload that wraps `globalThis.fetch` for one host, loaded with
  `NODE_OPTIONS=--import=file:///…`. Next patches fetch on top of it. Inline
  `cmd /c set "…" && npm run dev` in `.claude/launch.json` did **not** reach the
  server. A `.cmd` wrapper set as `runtimeExecutable` did, and the stub's log line
  showed in every Next process. Revert `launch.json` afterwards.
- **`AbortSignal.timeout` uses an unref'd timer.** In a harness whose stubbed fetch
  never settles, Node exits mid-`await` ("unsettled top-level await"). Hold the
  loop open with a `setInterval`. A server is unaffected.
- **Harnesses: `jiti`** (in `node_modules`) with `alias: { "@": repo }` imports
  `agent/*.ts` directly. `lib/env.ts` also needs dummy `NEXT_PUBLIC_INSFORGE_*`.

## Current state

- Lint, `tsc`, build and `openspec validate --all --strict` (3 specs) all pass. The
  offline harness passed 9 of 9 cases (scratchpad, wiped between sessions).
- Verified live with row counts:
  - concurrent pair: both 200, and no retry was needed;
  - first-503 stub: one retry, then success, charging exactly 1 `ai_usage` row;
  - always-503 stub, through the form: the unavailable alert after 3 requests in
    2.2 s, the run failed with `jobs_found 0`, 0 `ai_usage` rows, 0 jobs.
- Dev DB: 45 jobs (30 added by the test searches "Backend Developer / Chicago",
  "Data Engineer / Chicago" and "DevOps Engineer / Austin"), runs 10 completed and
  5 failed. `ai_usage` holds 4 `agent_find` rows from this session.
- Committed with this memory file. Nothing deployed.

## Next session starts with

Feature 12, the Job Details Page: `/opsx-propose`. Settle the `missing_skills`
question below first, because Feature 12 renders those lists.

## Open questions

- **Does the retry worsen a multi-user burst?** N refused searches can become 3N
  requests in about 2 s and push toward the per-minute 429. It is bounded, but it
  is unmeasured. Production `retrying 2 of 2` warns followed by 429s would show it.
- **Searches only read Adzuna's first page**, so repeating a query mostly says
  "all already in your list". Fetching later pages is a product decision.
- **`missing_skills` can contradict the profile**: one reply listed React and
  TypeScript as missing for a candidate who has both. Not benchmarked.
- Next fetches bare `/find-jobs` twice per navigation. Harmless; cause unknown.
- The status region is verified in the DOM, not with NVDA/VoiceOver. The 300 ms
  debounce is unmeasured. `?page=1e20` falls back to page 1.
- `context/library-docs.md`'s Adzuna example still shows `lib/adzuna.ts` throwing.
  The shipped module is `agent/adzuna.ts` and never throws.
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

- **Sign in first.** Signing in is the developer's job; never automate it. The pane's
  session survives dev-server restarts on port 3000.
- **The pane runs "hidden"**: `setTimeout` throttles to about 1 s. Space scripted
  keystrokes with a `MessageChannel` wait.
- **SQL oracle technique**: hash the expected order in SQL
  (`encode(sha256(convert_to(string_agg(…), 'UTF8')), 'hex')`), and compare it with
  the rendered rows. `position(lower(needle) in lower(col))` is a wildcard-free
  contains check.
- **Rolled-back dry runs**: in a `do $$ … $$` block, run the statement, collect
  counts, and `raise exception` with them. The error rolls everything back,
  including DDL.
- **Hash the rows you claim are untouched**, as `external_id|score|found_at|run_id`,
  before and after.
- **Adzuna probes** from a scratchpad script (keys read from `.env.local`, never
  printed) cost quota but no `ai_usage` slot. Keep a burst under about 15 a minute,
  or Adzuna answers 503 and 429 and the probe measures itself. `agent_runs` has no
  `created_at`; select runs by `job_title_searched`.
- PostHog ingestion lags 10–30 s. Wait for the search's `job_search_started`
  before concluding a `job_found` is absent.
- A node script doing string replacement on the CRLF `context/` docs leaves mixed
  line endings. Use the Edit tool, and count LF-only lines afterwards.
- The scratchpad is wiped between sessions. Check that a harness's expected case
  count actually ran.
- Carried over: reset viewport emulation before trusting a click; never print
  `.env.local` values; `assets/CV …pdf` is the uncommitted extraction fixture;
  never click Save Profile while testing.
