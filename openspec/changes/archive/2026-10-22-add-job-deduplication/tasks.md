## 1. Probe the insert mechanism before anything depends on it

Design D4. The SDK's types say `upsert` exists. Only the live records endpoint can show
whether it honours `on_conflict` and `resolution=ignore-duplicates`.

- [x] 1.1 **With the developer's approval** (it creates a table on the shared backend),
  create `public.dedup_probe (id uuid pk, owner text, ext text, v text, unique (owner, ext))`
  with RLS enabled and an `anon` all-access policy. From a scratchpad script using the
  SDK's `createClient` (anon key read from `.env.local`, value never printed), call
  `.upsert(rows, { onConflict: "owner,ext", ignoreDuplicates: true }).select("id, ext")`
  three times: a fresh row, the same row again, and a mixed batch of one known row and
  two new ones. Verify the results are 1 returned with no error, then 0 returned with no
  error, then 2 returned with no error, and that SQL counts 3 rows.
- [x] 1.2 Drop `dedup_probe` and confirm it is gone (`select to_regclass('public.dedup_probe')`
  is null). **Record the outcome in design D4.** If any assertion in 1.1 failed, switch to
  the RPC fallback: task 2.2 then adds `insert_search_jobs(jsonb)` and task 4.3 calls it
  through `.rpc()`.

## 2. Schema

- [x] 2.1 Write `db/migrations/005_add_jobs_external_id.sql` per design D9: a header
  comment giving the reasoning (why the id rather than the URL or title + company, and
  why the constraint is not partial), `add column if not exists external_id text`, the
  path-regex backfill, the earliest-row-wins delete, the `agent_runs.jobs_found` recount,
  and both constraints inside `if not exists` guards. Match `004`'s comment style. Verify
  by reading it against D9's five steps.
- [x] 2.2 *(Only if 1.2 chose the fallback — not needed: the probe passed, see design D4.)* Add the `security invoker`
  `insert_search_jobs(rows jsonb) returns setof public.jobs` function to `005`, with
  `on conflict (user_id, external_id) do nothing returning *`.
- [x] 2.3 **With the developer's approval:** `create table public.jobs_backup_005 as select * from public.jobs`,
  `enable row level security` on it, and record the before-counts (rows per user, the
  `jobs_found` of each run).
- [x] 2.4 **With the developer's approval:** apply `005` through `run-raw-sql`. Verify with
  SQL that `jobs` went from 20 rows to 10, there are 10 distinct `(user_id, external_id)`,
  `count(*) where source = 'search' and external_id is null` is 0, both constraints show
  in `pg_constraint`, the surviving row in each pair is the earlier one (compare
  `found_at` against the backup), and the two runs read 10 and 0.
- [x] 2.5 Run `005` a second time and verify it succeeds and changes nothing (same
  counts). This proves the guards are idempotent.
- [x] 2.6 Prove the constraints bite. *(Done: 23505 and 23514 raised and rolled back, 0 probe rows left. Only one user exists in `auth.users`, so the second-user insert was not run; per-user scope rests on the constraint definition `UNIQUE (user_id, external_id)`.)* In one transaction that ends in `rollback`: insert a
  copy of an existing row and verify 23505; insert a `source = 'search'` row with a null
  `external_id` and verify 23514; if a second user exists in `auth.users`, insert the
  same `external_id` for that user and verify it succeeds.

## 3. Provider normalisation

- [x] 3.1 In `agent/adzuna.ts`, add `id` to the response schema (string or number,
  coerced to a trimmed string, `.catch(undefined)`), add `externalId: string` to
  `AdzunaJob`, switch `normalise()`'s `seen` set to the id, and skip listings without an
  id alongside the existing title/URL skips. Log the skipped count on the existing
  "returned N usable listings" line. Verify `npx tsc --noEmit` and `npm run lint` pass.
- [x] 3.2 Offline harness (scratchpad; stub `globalThis.fetch` and dummy `ADZUNA_*` env
  values): a listing whose id arrives as a number, a missing id, an empty-string id, the
  same id twice with different URLs, and two ids sharing a title and company. Verify the
  harness prints how many cases actually ran (5) and that the output for each matches
  design D6.

## 4. Route

- [x] 4.1 In `types/index.ts`, add `newJobs?: number` to `FindActionResult` and document
  each of the three counts in one line (`jobsFound` = listings found, `newJobs` = rows
  this search inserted, `strongMatches` = of those). Verify `npx tsc --noEmit` passes.
- [x] 4.2 In `app/api/agent/find/route.ts`, after `recordAiCall`, add the known-id lookup
  (design D3). On a lookup error, log it and continue with an empty known set. Split
  `search.jobs` into `fresh` and known, and return early when `fresh` is empty: the run
  completes with 0, there is no `scoreJobs` call, and the response is
  `{ jobsFound, newJobs: 0, strongMatches: 0 }`. Verify lint passes.
- [x] 4.3 Score `fresh` only, and build the rows from `fresh` with `external_id`. Note
  that `matches[index]` now indexes into `fresh`, not `search.jobs`. Replace the plain
  insert with the D4 call that returns `id, match_score`. Derive `newJobs`,
  `strongMatches`, `finishRun`'s count, and `recordFoundJobs`' scores from the
  **returned** rows (D5). Verify `npx tsc --noEmit`, `npm run lint`, and `npm run build`
  pass.
- [x] 4.4 Re-read the route's comments (the module docblock, the `found_at` note, and the
  `job_found` docblock), correct anything the change made untrue, and confirm by grep
  that `jobRows.length` no longer drives any count.

## 5. Summary UI

- [x] 5.1 In `components/find-jobs/SearchControls.tsx`, add `newJobs` to the success
  state and render the three cases in design D8 with the existing `NOTICE_CLASS` and
  success classes. No new tokens or raw colour classes. Handle the plural per count.
  Verify `npm run lint` passes and that `grep -nE "#[0-9a-fA-F]{3,6}|(bg|text|border)-(red|green|blue|gray|slate)-"`
  finds nothing new in the file.
- [x] 5.2 Run `/imprint`. Update `context/ui-registry.md`'s SearchControls entry only if
  it quotes the old sentence or describes the outcomes. No new component, no new pattern.

## 6. End-to-end verification (billed: about 4 searches against a 10/hour limit)

The dev server must run where `.env.local` exists. Sign in in the Browser pane first.
Signing in is the developer's job.

- [x] 6.1 *(Done, run 11:00:26 UTC: `jobs` 15→15 with an identical row hash, `ai_usage`
  4→5, run completed 0, insforge.logs show `GET /jobs` (the lookup) and no
  `/chat/completion` or `POST /jobs`, notice "Found 10 jobs, all already in your list.",
  0 `job_found`. It ran after 6.2, because Adzuna's results had moved: see 6.2.)*
  **Repeat search, all known.** Search "Frontend Engineer" / "New York" (the
  same query as the 10 surviving rows). Before and after, count `jobs`, `ai_usage`, and
  `agent_runs`. Verify: `jobs` is unchanged; `ai_usage` +1; one new run, completed with
  `jobs_found = 0`; **no `/chat/completion`** in `get-container-logs` for that window;
  the notice reads "Found N jobs, all already in your list."; no `job_found` event in
  PostHog for that search. If Adzuna's results have moved since and some listings are
  new, record which and treat the run as 6.2's mixed case.
- [x] 6.2 *(Done, without the delete: the first repeat search at 10:59 UTC already found
  5 known and 5 new listings. Results: `jobs` 10→15, the hash of the 10 original rows
  unchanged, log "scored 5 of 5", summary "Found 10 jobs, 5 new, 1 strong match" with SQL
  showing 1 new row ≥70 (scores 30, 40, 60, 65, 70), run completed 5, and exactly 5
  `job_found` events carrying those 5 scores.)*
  **Mixed.** Delete 3 of the 10 rows by `external_id` (record which), then
  search again. Verify: +3 rows carrying exactly those ids; the 7 untouched rows have
  the same `match_score`, `found_at`, and `run_id` as before (compare against a snapshot
  taken just before); the matcher log scores 3, not 10; the summary says "Found 10 jobs,
  3 new, …" with strong matches equal to the SQL count of the 3 new rows scoring at or
  above 70; three `job_found` events; `agent_runs.jobs_found = 3`.
- [x] 6.3 *(Done, with 5587845853 and 5635308680 deleted. **Adzuna answers 503 to
  concurrent requests on one key**, even for two different queries, so a same-tick pair
  never reaches the DB. Both such pairs failed cleanly: runs `failed 0`, no slot charged,
  no rows. With the second request 1.5 s behind, both logged "8 of 10 already saved" and
  both scored 2. A got `newJobs: 2, strongMatches: 2` (75 and 70); B's conflict-ignore
  insert returned nothing, giving `newJobs: 0` and run completed 0. Each id exists once,
  there are 0 duplicate keys, and exactly 2 `job_found` events fired, both from A.)*
  **Race.** Delete 2 rows again. From the signed-in page, fire two
  `fetch("/api/agent/find", …)` POSTs in the same tick. Verify the 2 ids exist exactly
  once each, neither response is an error, the two `newJobs` values sum to 2, and the two
  runs' `jobs_found` sum to 2.
- [x] 6.4 *(Done: `/find-jobs` showed "Showing 1 to 13 of 13" with 13 rows, matching SQL.
  `?q=frontend&match=low&sort=newest` rendered 12 rows whose company|title sequence
  matched the SQL `position()` oracle exactly.)* Check that the list still works: `/find-jobs` total equals
  `select count(*) from jobs where user_id = …`, the filters and paging still match the
  SQL oracle on one combination, and `?q=` searches still work.
- [x] 6.5 Run `/verification-before-completion`: `npm run lint`, `npx tsc --noEmit`,
  `npm run build`, `npm run check:agents`, `npm run check:sync`, and
  `openspec validate --all --strict`. Paste the output.
- [x] 6.6 Drop `jobs_backup_005` (with the developer's approval) and verify
  `to_regclass` is null.

## 7. Docs, review, archive

- [x] 7.1 `context/architecture.md`: add `external_id` and the two constraints to the
  `jobs` schema block, and describe the write path (lookup, score new, conflict-ignore).
- [x] 7.2 `context/library-docs.md`: show `externalId` in the Adzuna mapping, record that
  `redirect_url`'s query string is per request while its path carries the id, and add the
  D4 insert pattern (or the RPC) to DB Queries.
- [x] 7.3 `context/build-plan.md` Feature 11 note: the key is Adzuna's id, not title +
  company, with a pointer to this change.
- [x] 7.4 `context/progress-tracker.md`: add the decision record (D1–D9 in short form,
  the probe outcome, the verification counts), and set Next to Feature 12.
- [x] 7.5 Run `/feature-review` (adversarial). Fix everything Critical or Important and
  re-verify the affected task's counts. Then `/opsx-archive`, then `/remember save`, and
  commit with `memory.md` staged in one one-line commit.

## 8. Review fixes

`/feature-review` found 0 Critical, 1 Important, and 2 Minor issues. The developer chose
to fix all three.

- [x] 8.1 *(Important.)* Design D10: in `app/api/agent/find/route.ts`, the lookup returns
  each saved id's `match_score`. Known-but-unscored listings join `fresh` in one scoring
  call. Their results are written with an update guarded by `.is("match_score", null)`,
  which touches only the four scoring columns, is not counted as new, and fires no
  event. Verify `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
- [x] 8.2 *(Minor. Done: in a rolled-back block on the live DB the statement deleted 0 rows and updated 0 runs, every run signature unchanged. With 3 later copies planted under one run (constraint dropped inside the same rolled-back block), it deleted exactly those 3 and took the run from 3 back to 0.)* `005`: replace the all-runs recount with a data-modifying CTE that
  subtracts only the duplicates it deleted (design D9 step 4). Verify the new statement
  in a rolled-back transaction against the live DB: it parses, deletes 0 rows, and
  changes 0 run counts.
- [x] 8.3 *(Minor.)* Fix the spec contradictions: the delta now modifies "Failures are
  reported without discarding usable results" and the out-of-range scenario. Verify
  `openspec validate --all --strict`.
- [x] 8.4 *(Done: Avoca AI 5889071313 was blanked (was 50). The search logged "10 of 10 already saved, 1 of them unscored" and "filled in 1 of 1". The gateway 429ed on the first attempt and the retry recovered. The row now has 75, a reason and 6 matched skills, with found_at and run_id unchanged. Still 15 rows, run completed 0, `newJobs: 0`, and no `job_found` beside its `job_search_started`. A guarded update on the now-scored row matched 0 rows in a rolled-back block.)* Live check of 8.1. With the developer's approval, blank one saved row's
  scoring values, then run one search that returns it. Verify the row gains a score
  while its `found_at` and `run_id` stay unchanged, the row count stays the same, the
  log reports 1 filled in, and no `job_found` event fires for it.
