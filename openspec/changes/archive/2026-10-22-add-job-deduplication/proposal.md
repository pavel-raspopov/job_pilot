## Why

Every search saves every listing Adzuna returns, including ones already in the user's
list. Running the same search twice doubles the list: the dev DB holds 20 rows from two
identical "Frontend Engineer / New York" searches, which are 10 jobs saved twice each.
Each copy is also scored again, which is billed, and the scores disagree (one listing
scored 30 the first time and 55 the second). Feature 11 moved deduplication out of the
list query on purpose: a count taken before dedup next to a page range taken after it
would make the footer lie. It is a write-path problem, and it has to be fixed before
Feature 12 gives each job its own details page, where two copies of the same job would
be two different URLs.

## What Changes

- **New `jobs.external_id` column** (migration `005`) holds the provider's own listing
  id. A unique constraint on `(user_id, external_id)` makes "one row per listing per
  user" a database guarantee, not just a check in application code. Existing rows get
  their id from the redirect URL's path, later copies are deleted (the earliest row is
  kept), and a check requires every search-found job to carry an id.
- **`agent/adzuna.ts` reads Adzuna's `id`.** It dedupes within one response by that id
  instead of by redirect URL, and drops a listing that has no id.
- **`POST /api/agent/find` saves and scores only new listings.** It looks up which ids
  the user already has, sends only the rest to the matcher, and inserts with
  conflict-ignore, so two concurrent searches cannot both save the same listing. When
  every listing is already saved, the route makes no model call and inserts nothing.
- **A job already in the list is left alone.** Its score, reason, and Date Found stay as
  they were when it was first found. It is not re-scored, not moved to the top, and not
  attached to the new run.
- **The summary reports found and new.** `FindActionResult` gains `newJobs`. The summary
  reads like "Found 10 jobs, 3 new, 1 strong match", and strong matches count only the
  new jobs. A search where every listing is already saved shows an informational
  message, not a success message.
- **The run count and `job_found` events cover only newly saved jobs**, so re-finding a
  listing does not inflate the dashboard (Features 15–17).

### Source reconciliation

| Conflict | Resolution |
|---|---|
| `build-plan.md` Feature 11 and the Feature 10 tracker entry say the key needs "title + company at minimum", because `redirect_url` changes between requests | **Adzuna's listing `id`, chosen by the developer.** Probed on 2026-10-22: two identical requests returned the same 10 ids. The ids in the stored September URLs match today's, and every duplicate pair in the dev DB shares one id, including the two pairs whose URLs differ. Only the URL's query string (`se`, `utm_*`) changes. Title + company would merge two openings that share a title at one employer, and would split one listing if its title were edited. The note about `redirect_url` stays correct: it is still not the key. |
| `library-docs.md`'s `AdzunaJob` type lists `id`, but the shipped normaliser drops it | Read `id` and correct the docs to show where it is stored |

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `job-discovery`: persisting saves only listings the user does not already have, and
  scoring covers only those listings. The run count, the reported counts, and the
  per-job analytics events all describe newly saved jobs, and the response also
  reports how many listings were found.
- `find-jobs`: the search summary reports found, new, and strong-among-new. A search
  that finds only listings already saved gets its own informational outcome.

## Impact

**New:** `db/migrations/005_add_jobs_external_id.sql`.

**Modified:** `agent/adzuna.ts` (`externalId`, dedupe by id), `app/api/agent/find/route.ts`
(known-id lookup, score new only, conflict-ignore insert, counts from inserted rows),
`types/index.ts` (`FindActionResult.newJobs`, `JobRow` if it mirrors columns),
`components/find-jobs/SearchControls.tsx` (summary copy and the all-known outcome).

**Unchanged:** `agent/matcher.ts` (its `minItems` already follows the batch size), the
rate limiter (a search still costs one slot once Adzuna answers), and the list query.

**Docs:** `context/architecture.md` (schema), `context/library-docs.md` (Adzuna mapping),
`context/build-plan.md` (Feature 11 dedup note), `context/progress-tracker.md`,
`context/ui-registry.md` (only if the summary's pattern changes).

**Dependencies:** none.

### Human gates

- **Migration `005` changes the shared InsForge database.** It deletes duplicate rows,
  which can't be undone. It runs through the InsForge MCP only with the developer's
  approval at that step. Today it affects dev data only: 20 rows become 10, and nothing
  is deployed.
- **An end-to-end check costs one real search**: one Adzuna request and up to two
  gateway calls. `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` are present in `.env.local`
  (names checked, values never printed). This worktree has no `.env.local`, so the dev
  server has to run where that file exists.

## Non-goals

- **Re-scoring saved jobs** when the profile changes. That needs its own trigger and its
  own billing decision.
- **Matching the same opening across providers or across Adzuna listings.** One ad
  posted twice under two ids stays two jobs.
- **Moving re-found jobs to the top, or keeping a "last seen" date.** Date Found keeps
  meaning first found.
- **Pruning stale listings** that Adzuna has stopped returning.
- **URL-based job import** (`source = 'url'`). Out of product scope. Its null
  `external_id` stays allowed, and NULLs never conflict under the unique constraint.
- **Feature 12** (job details page).
- **A test framework.** Verification is `npm run lint`, `npm run build`, `npx tsc
  --noEmit`, SQL counts before and after through the InsForge MCP, and a manual
  click-through.
