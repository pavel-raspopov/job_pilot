## 1. Retry in the provider module

- [x] 1.1 In `agent/adzuna.ts`, add `ADZUNA_MAX_ATTEMPTS = 3`, `ADZUNA_RETRY_BASE_MS = 300`
  and `ADZUNA_MIN_ATTEMPT_MS = 2_500` beside `ADZUNA_TIMEOUT_MS`, each with a comment
  giving its reason (design D2, D3). Add a `sleep(ms)` helper and a `retryDelay(attempt)`
  that returns a uniform value in `[base·2^(n−1), 2·base·2^(n−1)]`. Verify with
  `npx tsc --noEmit` and `npm run lint`.
- [x] 1.2 In `searchJobs()`, create the abort signal once and loop the `fetch`. Retry
  only on `status === 503`, while attempts remain and the deadline check passes (D3).
  Cancel the refused body before waiting (D4). Log each retry as in D5 and make the
  final error string ``adzuna http ${status} after ${attempt} attempt(s)``. Leave the
  non-503 paths, JSON parsing, validation and logging unchanged. Update the doc comment
  on `searchJobs()` and the module's "Nothing here throws" comment if they no longer
  describe the function. Verify with `npx tsc --noEmit` and `npm run lint`, and read
  the diff to confirm that the only behaviour change is on 503.

## 2. Offline harness

- [x] 2.1 Write a scratchpad harness that stubs `globalThis.fetch` with scripted
  responses, sets dummy `ADZUNA_APP_ID`/`ADZUNA_APP_KEY`, imports `agent/adzuna.ts` and
  captures console output. Cases:
  (a) `[200]`: success, 1 call;
  (b) `[503, 200]`: success, 2 calls, the wait in 300–600 ms;
  (c) `[503, 503, 200]`: success, 3 calls, the second wait in 600–1200 ms;
  (d) `[503, 503, 503]`: failure `adzuna http 503 after 3 attempt(s)`, exactly 3 calls;
  (e) `[429]`: failure, 1 call;
  (f) `[500]`: failure, 1 call;
  (g) a 503 that arrives after 8 s: failure with no retry, 1 call, total under 10 s;
  (h) a fetch that never answers: `adzuna request failed` at about 10 s, 1 call.
  Also, in every case, the captured output contains neither dummy credential nor
  `app_key`. Verify that the harness prints how many cases ran (8) and that each
  passed.

## 3. Static verification

- [x] 3.1 Run `npm run lint`, `npx tsc --noEmit`, `npm run build` and
  `openspec validate --all --strict`, and show the output. All four must pass.

## 4. Live verification (human gate: the developer signs in to the Browser pane)

- [x] 4.1 *(Done. Both 200 in 6.7 s and 6.8 s, 10 new each. Runs completed 7 → 9,
  `ai_usage` 9 → 11, jobs 15 → 35. **No retry occurred**: Adzuna answered both with 200,
  as the proposal predicted.)* **Concurrent pair, real provider.** Snapshot the counts of `agent_runs` by
  status and of `ai_usage` rows for the user (InsForge MCP `run-raw-sql`, read-only).
  From the signed-in Browser pane, fire two `fetch("/api/agent/find", …)` POSTs in the
  same tick with different titles. Verify that both responses succeed, there are +2
  completed runs and +2 `ai_usage` rows, and the server log shows any retries that
  happened. Per the proposal, this pair may pass with no retry. Record whether one
  occurred.
- [x] 4.2 *(Done. Inline `cmd /c set …` args did not reach the server, so each launch
  config ran a scratchpad `.cmd` wrapper instead. The stub's "active" line appeared in
  every Next process. Log: stub call 1 → 503, `retrying 1 of 2`, call 2 passed through,
  `us returned 10 usable listings`, scored 10 of 10. 200 in 7.5 s. Runs completed
  9 → 10, `ai_usage` 11 → 12 (one row for two provider requests), jobs 35 → 45.)*
  **Retry proven end to end.** Write the scratchpad preload stub (design D6) and
  add a temporary `.claude/launch.json` configuration that starts `next dev` with
  `NODE_OPTIONS=--import=<stub URL>` and `ADZUNA_STUB=first-503`. Confirm the stub's log
  line appears. Run one search. Verify that the log shows one retry warn and then
  "returned N usable listings", the response succeeds, and the counts show +1 completed
  run and exactly +1 `ai_usage` row.
- [x] 4.3 *(Done through the Find Jobs form. The alert read "Job search is unavailable
  right now. Please try again." Log: three stubbed 503s, `retrying 1 of 2`,
  `retrying 2 of 2`, then `provider failed: adzuna http 503 after 3 attempt(s)`. POST
  took 2.2 s. Runs failed 4 → 5 (the "Site Reliability Engineer / Denver" run is
  `failed`, `jobs_found 0`), `ai_usage` 12 → 12, jobs 45 → 45.)* **Persistent outage.** Restart with `ADZUNA_STUB=always-503`. Run one search.
  Verify that the user sees "Job search is unavailable right now. Please try again.",
  the log shows two retry warns and then `adzuna http 503 after 3 attempt(s)`, there is
  +1 `failed` run with `jobs_found = 0`, there are **0** new `ai_usage` rows and 0 new
  jobs, and the request finished within about 5 s.
- [x] 4.4 *(Done. `git diff --stat .claude/launch.json` is empty.)* Remove the temporary launch configuration, stop the stubbed server, and
  verify with `git diff --stat .claude/launch.json` that the file is unchanged.

## 5. Docs and close-out

- [x] 5.1 Update `context/library-docs.md` (Adzuna section: the 503 retry, why 429 is
  not retried, the shared 10 s budget), and `context/progress-tracker.md` (this fix,
  plus the corrected wording of the 503 finding if the developer confirms the
  proposal's reconciliation). Verify by reading the neighbouring entries for style.
- [x] 5.2 *(Done. `/feature-review` found 1 Minor: the swallowed `cancel()` rejection.
  It is now logged. Harness case i, a rejecting `cancel`, was added, and 9 of 9 cases
  pass. Lint, `tsc`, build and `openspec validate --all --strict` were re-run after the
  fix. Archive, memory and commit follow.)* Run `/verification-before-completion`, then `/feature-review`, then
  `/opsx-archive`. Then `/remember save`, updating `memory.md`'s open question and its
  "Problems solved" entry. Commit on `main` with a one-line message and stage
  `memory.md` with the work.
