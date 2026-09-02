# Find Jobs Page — Full UI

## Why

`/find-jobs` is linked from the Navbar on every authenticated page and is listed in the
middleware's protected routes, but the route does not exist — the link 404s today. Phase 3
of `context/build-plan.md` opens with Feature 09, which builds the page shell so that
Feature 10 (Adzuna discovery) and Feature 11 (filter/sort/pagination against real data)
have a surface to land in rather than a page to invent.

This change delivers the complete Find Jobs interface against hardcoded mock data. No
Adzuna call, no database read, no AI, no new API route.

## What Changes

- **New route `/find-jobs`** — an authenticated server page holding a 24-job mock array.
  This array is the single seam Features 10/11 replace with a `jobs` query.
- **Search controls card** — JOB TITLE and LOCATION inputs, a Find Jobs primary button,
  and a green success banner ("Found 8 jobs and saved 4 strong matches.") revealed on
  click. The button performs no request; Feature 10 replaces the local state with a real
  `POST /api/agent/find`.
- **Filter bar** — free-text filter by company or role, a match filter (All Matches /
  High Match / Low Match), and a sort control (Match Score / Newest / Oldest).
- **Jobs table** — six columns: COMPANY, ROLE, MATCH SCORE (inline colour-banded bar plus
  percentage), SALARY EST., SOURCE (badge), DATE FOUND (relative). Rows have a hover state
  but are **not** links.
- **Pagination** — "Showing X to Y of N results", Previous / numbered pages / Next, six
  rows per page over the 24 mock jobs.
- **Empty state** — shown when the active filter matches no jobs.
- **New shared types** — `Job`, `MatchFilter`, `JobSort` in `types/index.ts`, mirroring the
  `jobs` table so Features 10–12 reuse them rather than redeclaring.
- **New `lib/utils.ts`** — `formatRelativeDate()` for the DATE FOUND column. Already named
  in `context/architecture.md`, previously unbuilt.

### Source reconciliation

Four conflicts between `context/build-plan.md`, `context/designs/find-jobs.png`, and
`context/project-overview.md`. All four were surfaced to the developer and resolved before
this proposal; the rationale is recorded in `design.md`.

| Conflict | Resolution |
| --- | --- |
| Design draws 5 columns; build-plan and project-overview list a SOURCE badge | **Developer decision: 6 columns**, SOURCE included |
| project-overview says a row click opens job details; `/find-jobs/[id]` is Feature 12 | **Developer decision: hover state only**, rows are not links |
| "Mock data, no logic" vs. controls a user can operate | **Developer decision: live client-side** filter/sort/search/pagination over the mock array |
| Design paints 88% and 85% score bars blue; `ui-tokens.md` says green from 70 | **`ui-tokens.md` wins** — already reconciled 2026-07-31 because green-from-70 matches the High Match boundary (`match_score >= 70`). No blue bar appears |

## Capabilities

### New Capabilities

- `find-jobs`: The authenticated Find Jobs page — search controls and their result banner,
  the filterable/sortable/paginated job list, the match-score presentation, and the empty
  state. This change specifies the presentation-layer behaviour only; job discovery
  (Feature 10) and server-side querying (Feature 11) extend the same capability later.

### Modified Capabilities

None. The `profile` capability is untouched.

## Impact

**New files**

- `app/(app)/find-jobs/page.tsx`
- `components/find-jobs/SearchControls.tsx`
- `components/find-jobs/JobFilters.tsx`
- `components/find-jobs/JobsTable.tsx`
- `components/find-jobs/JobsPagination.tsx`
- `lib/utils.ts`

Component filenames are fixed by the tree in `context/architecture.md`; no fifth component
is introduced.

**Modified files**

- `types/index.ts` — add `Job`, `MatchFilter`, `JobSort`
- `context/ui-registry.md` — three new patterns (success banner, data table, inline score
  bar) recorded via `/imprint`
- `context/architecture.md` — note that `JobsTable` is the stateful container
- `context/progress-tracker.md` — check off Feature 09

**Not affected:** no database migration, no InsForge call, no PostHog event
(`job_search_started` and `job_found` belong to Feature 10), no new dependency, no change
to `next.config.ts` or middleware (`/find-jobs` is already protected).

## Non-goals

Scope is Feature 09 only. Explicitly out:

- Any Adzuna API call, `agent_runs` record, or `jobs` table read or write
- `POST /api/agent/find` or any other route handler or server action
- AI scoring of jobs — mock `match_score` values are hardcoded
- The `/find-jobs/[id]` job details route (Feature 12)
- PostHog events (Feature 10)
- "Jobs by Adzuna" attribution — deferred to Feature 10, when the page first shows real
  Adzuna data. Crediting a source the page has not used would be a false claim
- Server-side filtering, sorting, or pagination, and the 20-per-page size (Feature 11)
- Any change to the retired inert-CTA pattern or other existing UI

## Verification

This repo has no test runner. Per `AGENTS.md`, do not add one.

- `npm run lint`
- `npm run build`
- `openspec validate --strict`
- Manual click-through of `/find-jobs` in the browser: banner reveal, filter, sort, search,
  pagination edges, empty state, score-bar colours, mobile table overflow, clean console

**Secret-dependent steps:** none. This feature reads no environment variable beyond what
the existing authenticated layout already requires (`NEXT_PUBLIC_INSFORGE_*` for the
session read in `(app)/layout.tsx`). There is no new human gate, and end-to-end
verification is fully achievable locally.
