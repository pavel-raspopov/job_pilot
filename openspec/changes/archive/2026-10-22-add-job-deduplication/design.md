## Context

See `proposal.md` (Why). The requirements are in `specs/job-discovery/spec.md` and
`specs/find-jobs/spec.md`. This document covers only how they are met.

These facts constrain the approach. Each was established before this design was written:

- **Adzuna's listing `id` is stable, and the apply URL carries it.** Two identical
  requests on 2026-10-22 returned the same 10 ids. The redirect URL's *path* is
  `/land/ad/<id>` or `/details/<id>`, and only its query string (`se`, `utm_*`) varies.
  All 20 stored rows give up an id from that path. Every one of the 10 duplicate pairs
  shares an id, including the two pairs whose stored URLs differ. Verneek's
  `5635308680` is identical in the September rows and today.
- **The scoring model is not deterministic.** The same listing scored 30 in one run and
  55 in the next. Re-scoring a known job changes a number the user has already seen,
  for no reason, and charges for it.
- **`@insforge/sdk` 1.5.0 wraps `@supabase/postgrest-js`**, so the query builder's types
  include `.upsert(rows, { onConflict, ignoreDuplicates })`. The SDK docs do not mention
  it, and the records endpoint already mangles one PostgREST feature (two `or=` keys,
  see `memory.md`), so the method has to be **probed against the live backend before
  anything depends on it**. A probe during planning was refused because it needed a
  temporary table, so it is task 1.
- **`jobs` RLS** (`001_initial_schema.sql`) has select/insert/update/delete policies
  scoped to the row's owner. Conflict-ignore needs only insert and select.
- **A plain `insert([...])` is atomic.** With a unique constraint in place, one known
  listing in the batch would reject all ten rows with a 23505 error. Conflict handling
  is therefore required, not optional, once the constraint exists.

### Files in scope

**New:** `db/migrations/005_add_jobs_external_id.sql`.

**Modified:** `agent/adzuna.ts`, `app/api/agent/find/route.ts`, `types/index.ts`
(`FindActionResult` only), `components/find-jobs/SearchControls.tsx`, and the docs named
in the proposal.

**Frozen:** `agent/matcher.ts`, `lib/ai-rate-limit.ts`, `lib/parse-job.ts`,
`app/(app)/find-jobs/page.tsx`, `components/find-jobs/JobsTable.tsx`, `JobFilters.tsx`,
`JobsPagination.tsx`, `lib/job-list-params.ts`, and migrations `001`–`004`. Changes to
these are limited to one-line type or compile fixes, and only if `npm run build` or
`npx tsc --noEmit` fails. The list never needs `external_id`. `select('*')` returns the
new column and `parseJobRow` ignores it.

## Goals / Non-Goals

**Goals:** one row per (user, Adzuna listing), guaranteed by the database; no billed
scoring for listings already saved; counts and events that describe what the search
actually saved, including when two searches race.

**Non-Goals:** see `proposal.md`. At design level: no change to the list query, the
matcher, or the rate limiter, and no `upsert` that updates an existing row.

## Decisions

### D1. Key on Adzuna's `id`, stored raw as `jobs.external_id text`

The developer chose this over the build plan's title + company, after the probe above.
The value is stored as Adzuna sends it, as a string of digits, with no country or
provider prefix:

- `source = 'search'` already says the provider is Adzuna, and the only other source,
  `'url'`, is out of product scope.
- The backfill can only recover the bare id from the URL path. A prefix would make old
  rows and new rows disagree.
- Ids are already scoped by `user_id`. A collision would need the same digits to
  identify two different ads for one user.

The normaliser accepts `id` as a string or a number, coerces it to a trimmed string, and
treats an empty result as missing. **Alternative rejected:** `bigint`. Nothing does
arithmetic on the id, and Adzuna documents it as a string.

### D2. Enforce with a full unique constraint, not a partial index

`unique (user_id, external_id)` on the whole table, plus
`check (source <> 'search' or external_id is not null)`.

- PostgREST's `on_conflict` emits `ON CONFLICT (cols)` with no `WHERE`, and Postgres can
  match that only against a **non-partial** unique index. A partial index
  (`where source = 'search'`) would make every conflict-ignore insert fail with "no
  unique or exclusion constraint matching".
- NULLs are distinct by default, so future `'url'` rows with no `external_id` never
  conflict.
- The check turns "every search row is deduplicable" into an invariant. A listing that
  arrives without an id is dropped in the normaliser (D6), so the check never rejects a
  live insert. It exists to stop a future code path from quietly bypassing dedup.
- The constraint's index also serves the known-id lookup (D3).

### D3. Look up first, then insert with conflict-ignore. Both are needed

After Adzuna answers and the slot is recorded:

1. **Lookup:** `select('external_id').eq('user_id', userId).in('external_id', ids)`. At
   most 10 ids, served by the D2 index.
2. **Score** only the listings whose id was not found.
3. **Insert** those rows with conflict-ignore, returning `id, match_score`.

Neither step is enough on its own:

- The lookup alone races. Two tabs searching at once both see a listing as new, and the
  second plain insert fails the whole batch (Context, last bullet).
- The constraint alone would still send known listings to the model, which is the cost
  and score-drift problem this change exists to fix.

**If the lookup fails**, the search degrades and does not fail. It logs the error,
treats nothing as known, and scores everything. Correctness still holds because the
insert ignores conflicts. The cost is one over-billed search, which is better than
refusing a search the user has already spent a slot on.

### D4. Insert mechanism: probe `upsert`, fall back to an RPC

**Preferred:** `.upsert(rows, { onConflict: "user_id,external_id", ignoreDuplicates: true })`
followed by `.select("id, match_score")`. In PostgREST this is
`Prefer: resolution=ignore-duplicates,return=representation` plus `?on_conflict=...`.
The response contains **only the rows actually inserted**, and D5 depends on that.

**Task 1 probes it** against a temporary table with the same constraint shape. Running
it needs the developer's approval, and the table is dropped right after. The probe
asserts three things:

1. a fresh row is inserted and returned;
2. a duplicate row is skipped *without error* and *not returned*;
3. a mixed batch returns only its new rows.

**Fallback, if any assertion fails:** a `security invoker` SQL function in migration
`005`, `insert_search_jobs(rows jsonb) returns setof jobs`, which does
`insert … select … from jsonb_populate_recordset(…) on conflict (user_id, external_id) do nothing returning *`,
called through `insforge.database.rpc()`. Because it is `security invoker`, RLS still
applies. Either way the contract is the same: the call returns the inserted rows.
**Rejected:** catching 23505 and retrying row by row. That is up to 10 round trips, and
it races again on the retry.

**Probe outcome (2026-10-22): `upsert` works; the fallback is not built.** Against
`dedup_probe (unique (owner, ext))` through the SDK with the anon key: a fresh row was
inserted and returned `['A']`; the same row again returned `[]` with no error; a mixed
batch returned `['B', 'C']` with no error; and SQL showed `A` still holding its first
value (`v = 'first'`), so ignore-duplicates never overwrote. Two rows with a NULL `ext`
both inserted, which confirms that NULLs don't conflict (D2). The table was dropped
afterwards (`to_regclass` is null).

### D5. Count from the rows the database returned, not from the rows sent

`newJobs`, `strongMatches`, `agent_runs.jobs_found`, and the `job_found` events all
derive from the inserted rows the D4 call returns. When two searches race on one
listing, both have scored it, but only the search that actually inserted it reports and
counts it (spec: "only the search that actually saved it"). `jobsFound` is the number of
listings Adzuna returned after normalisation.

`FindActionResult` becomes `{ success, error?, jobsFound?, newJobs?, strongMatches? }`.
**`jobsFound` changes meaning** from "saved" to "found". Its only consumer is
`SearchControls`, which changes in this same change. `agent_runs.jobs_found` keeps
meaning "saved by this run", so the dashboard features read it as "new jobs".

### D6. Dedupe within a response by `id`; drop listings without one

`normalise()`'s `seen` set switches from `redirectUrl` to the id. A listing without an
id joins the existing "dead row" skips (no title, no URL). The route logs the number of
dropped listings next to the existing "returned N usable listings" line. `AdzunaJob`
gains `externalId: string`.

### D7. Re-found jobs are untouched (developer decision)

The mechanism is conflict-*ignore*, never merge. The existing row keeps its score,
reason, skills, `found_at` (Date Found keeps meaning first found), and `run_id` (it
stays attached to the run that found it first). The one exception, a row saved with no
score, is D10.

### D8. Summary copy and the all-known outcome

The summary stays in `SearchControls`' existing `role="status"` region, and three
states are told apart by the counts:

| Counts | Presentation |
|---|---|
| `jobsFound === 0` | existing `NO_RESULTS_MESSAGE` notice (unchanged) |
| `jobsFound > 0`, `newJobs === 0` | notice style (`NOTICE_CLASS`): "Found 10 jobs, all already in your list." |
| `newJobs > 0` | existing success style: "Found 10 jobs, 3 new, 1 strong match." |

Singular and plural are handled per count. No new token, component, or pattern: both
styles already exist in the component, so `ui-registry.md` changes only if its
SearchControls entry quotes the old sentence. The client state type gains `newJobs`.
`router.refresh()` still runs on every success, which is harmless when nothing changed.

### D9. Migration `005`: back up, backfill, collapse, constrain, recount

The migration is idempotent where Postgres allows it (`add column if not exists`, a
backfill limited to `where external_id is null`, constraints added inside
`do $$ … if not exists … $$`):

1. `add column if not exists external_id text`.
2. **Backfill** with
   `substring(external_apply_url from '/(?:land/ad|details)/([0-9]+)')` for
   `source = 'search'`.
3. **Collapse duplicates.** For each `(user_id, external_id)`, keep the row with the
   earliest `found_at` (tie broken by `id`) and delete the rest. Keeping the earliest
   matches D7: Date Found means first found.
4. **Subtract** what step 3 deleted from each run's `jobs_found`, so a run's count keeps
   meaning "saved by this run" (spec). On the dev DB, the September 24 13:56 run goes
   from 10 to 0, which is now the truth. *(Corrected after review.)* Steps 3 and 4 are
   one statement: a data-modifying CTE deletes the duplicates and returns their
   `run_id`s, and the update subtracts those counts. The first draft instead **recounted
   every run** from the surviving rows. That made every re-run a silent rewrite of
   history: once jobs can be deleted, a re-run would lower old runs' counts. Subtracting
   only the deleted duplicates makes a re-run a true no-op, because it deletes nothing.
   The applied result is identical (only the 13:56 run lost rows), so the dev DB is
   already in the state the corrected file produces.
5. Add the unique constraint and the check constraint. If any search row failed to
   backfill, the check **fails the migration loudly**. That is deliberate: a silent null
   would be a dedup hole. All 20 current rows match the pattern.

The header comment carries the reasoning: why the id and not the URL, and why the
constraint is not partial. That matches the style of `003` and `004`.

### D10. A saved-but-unscored row is scored on its next appearance (added after review)

**The flaw the review found:** the matcher degrades to saving listings without a score
when the gateway fails (seen on 2026-09-24). Before dedup, repeating the search was the
(billed) way to recover. With D3 and D7 as first written, the repeat found every id
already saved, scored nothing, and left the rows showing "—" for good. Nothing else in
the app re-scores a job.

**The fix:** the lookup returns `external_id, match_score`. A known row with a null
score joins the scoring batch alongside the new listings, in one call. Its result is
written with an update guarded by the null:

```ts
.update({ match_score, match_reason, matched_skills, missing_skills })
.eq("user_id", userId).eq("external_id", id).is("match_score", null)
```

- **Never overwrites.** The `is null` guard means a concurrent search that already
  filled the score turns this update into a zero-row no-op. That is the update-side
  equivalent of D4's conflict-ignore.
- **Touches only the four scoring columns**: `found_at`, `run_id`, and the listing data
  stay as first saved.
- **Not counted as new.** A filled-in row is neither `newJobs` nor a strong match, and
  it fires no `job_found` (it was counted when first saved). The route logs how many
  rows it filled in. `FindActionResult` gains no field: the list shows the new score,
  and the summary's "all already in your list" stays true.
- **Best effort.** A failed fill-in update is logged and does not fail the search, since
  the jobs are already saved. A row whose score comes back null again stays unscored
  until the next search.
- **One update per row, sequentially.** At most 10 rows, and in practice 0. An RPC to
  batch them is not worth a migration.

**Rejected:** re-scoring every known row (rejected for cost and score drift, D7), and a
"re-score" button (new UI and scope, and the next search already has the listing in
hand).

## Risks / Trade-offs

- **The InsForge records endpoint mishandles `upsert`** → task 1 probes it first, and
  the D4 RPC fallback is fully specified, so a failed probe changes only which call the
  route makes.
- **Two racing searches both score the same new listing** (billed twice) → accepted,
  because it needs two tabs within one ~10 s window. Counting stays correct (D5).
- **The migration deletes rows**, and nothing in the app can undo it → task 2 copies
  `jobs` to `jobs_backup_005` (with `enable row level security` and no policies, per the
  memory's testing note), verifies the counts, and drops the backup only once
  verification passes.
- **Adzuna reposts an ad under a new id** → it shows up as a new job. Accepted, and
  listed as a non-goal. It is still better than title + company merging distinct
  openings.
- **`jobsFound` changes meaning** → its single consumer changes in the same commit.
  `npx tsc --noEmit` catches the new `newJobs` field, but not the semantic change, so
  task 6 checks it by reading the code.
- **The lookup degrades to "nothing known"** (D3) and bills a full batch → logged, so the
  failure can be seen in the server output.

## Migration Plan

1. Task 1: probe `upsert`, needs approval. The result decides D4's path.
2. Task 2: back up `jobs`, then apply `005` through the InsForge MCP `run-raw-sql`, with
   approval. Assert 20 rows become 10, 10 distinct `(user_id, external_id)` remain, no
   search row has a null `external_id`, both constraints exist, and the run counts are
   10 and 0.
3. Deploy the code. Nothing is deployed today, so this is local only.

**Rollback:** `alter table jobs drop constraint …` (both), `drop column external_id`,
and restore deleted rows from `jobs_backup_005` while it still exists. Once the backup
is dropped, the deleted duplicates are gone. That is acceptable because they were
copies.
