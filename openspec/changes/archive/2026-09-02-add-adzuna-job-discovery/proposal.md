## Why

`/find-jobs` is a complete, verified interface sitting on top of 24 hardcoded rows.
Feature 09 built it that way deliberately — the search button reveals a summary and
issues no request — so that this change replaces only where the data comes from, not
how it is presented.

This is also the first feature in JobPilot where clicking a button spends money. Every
search is one billed call to the InsForge AI gateway plus one call against a shared
Adzuna free-tier quota, so the guards that earlier AI features paid for in real bugs
(`maxDuration`, a server-side rate limit, a synchronous in-flight guard) are
requirements here, not polish.

## What Changes

- **New `POST /api/agent/find`** — validates input, authenticates, loads the profile,
  rate-limits, records an `agent_runs` row, queries Adzuna, scores the results, writes
  `jobs`, and reports per-run counts.
- **New `agent/` layer** — `agent/adzuna.ts` (search, country detection, salary
  formatting, response normalisation) and `agent/matcher.ts` (one batched scoring call
  against the profile). Neither ever throws; both return typed results the route maps
  to user-facing copy.
- **Find Jobs page reads the database.** `app/(app)/find-jobs/page.tsx` becomes an
  async server component selecting the signed-in user's `jobs`. `buildMockJobs()` and
  the 24-row mock array are deleted.
- **`SearchControls` performs a real search.** Gains a synchronous `useRef` in-flight
  guard, a loading state, error display, and `router.refresh()` on success. Its
  `jobsFound` / `strongMatches` props are removed — **BREAKING** for that component's
  contract, because after a search the truthful counts are the run's, not the table's.
- **Empty state splits three ways** — no jobs yet, no jobs matching filters, and load
  failed. The first case is reachable for the first time in this change.
- **Two PostHog events** — `job_search_started` (client) and `job_found` (server, one
  per saved job).
- **Rate limit** — a new `agent_find` route key at 10 searches/hour, counted per search
  rather than per job.
- No migration. `agent_runs` and `jobs` already exist; `ai_usage.route` is free text.

### Source reconciliation

Four documented conflicts, each resolved here rather than left for the next feature:

| Conflict | Resolution |
|---|---|
| `library-docs.md` puts the Adzuna client in `lib/adzuna.ts`; `architecture.md` says `agent/adzuna.ts` — and also contradicts itself by listing `lib/adzuna.ts` in the `lib/` tree | **`agent/adzuna.ts`.** The module holds discovery logic, which the boundary table assigns to `agent/`. Remove the stale `lib/` line |
| `library-docs.md`'s snippet reads `process.env.ADZUNA_APP_ID!`; `code-standards.md` mandates `env.X` from `lib/env.ts` | **`lib/env.ts`**, via a new lazily-validated server-only accessor (design.md explains why a plain schema extension breaks the client bundle) |
| `code-standards.md`'s route template returns HTTP 500 on failure; both shipped routes return HTTP 200 with `{success:false,error}` and clients read `result.success` | **Shipped pattern wins.** Correct the doc in this change |
| `code-standards.md` asserts errors are logged to `agent_logs` via `logAgentError()`, which does not exist; build-plan's Feature 10 never asks for it | **Defer to Feature 13**, which genuinely needs it. Record as a decision, not an omission |

Also: build-plan and project-overview name **GPT-4o**, superseded by Features 07/08's
InsForge-gateway-plus-benchmark rule. And `project-overview.md` requires the Adzuna
query be `category`-filtered to IT jobs, which build-plan's parameter list omits — the
filter is applied.

## Capabilities

### New Capabilities

- `job-discovery`: Searching an external job provider for listings matching a title and
  location, scoring each against the user's profile, persisting the results as a
  recorded run, and reporting per-run counts. Covers authentication, input validation,
  profile prerequisites, rate limiting, run lifecycle, and every partial-failure mode.

### Modified Capabilities

- `find-jobs`: Three requirements change behaviour. **Job search controls** — the search
  now issues a real request, has loading and error states, and reports counts from that
  run (the current spec explicitly requires the opposite). **Job list presentation** —
  rows come from the signed-in user's saved jobs rather than fixed sample data.
  **Empty job list state** — three distinct causes, only one of which is "filters
  matched nothing".

## Impact

**New:** `agent/adzuna.ts`, `agent/matcher.ts`, `app/api/agent/find/route.ts`,
`lib/parse-job.ts`.

**Modified:** `lib/env.ts` (server-only accessor), `lib/ai-rate-limit.ts` (`agent_find`
key and limit), `types/index.ts` (`FindActionResult`),
`app/(app)/find-jobs/page.tsx` (async, DB-backed), `components/find-jobs/SearchControls.tsx`
(rewrite), `components/find-jobs/JobsTable.tsx` (`loadFailed` prop, three-way empty state).

**Unchanged:** `components/find-jobs/JobFilters.tsx`, `JobsPagination.tsx`. The
four-file constraint on `components/find-jobs/` holds — no fifth file.

**Docs:** `context/architecture.md`, `context/code-standards.md`,
`context/ui-registry.md`, `context/progress-tracker.md`.

**Dependencies:** none added. Adzuna is reached with `fetch`.

### Human gates

- **`ADZUNA_APP_ID` and `ADZUNA_APP_KEY` must exist in `.env.local`** (no
  `NEXT_PUBLIC_` prefix — they are secrets). Obtained from the Adzuna developer portal
  at `developer.adzuna.com`. Verification checks that the *names* are present; values
  are never printed, logged, or committed.
- Without them, no end-to-end claim can be made: `agent/adzuna.ts` returns a service
  error and the feature is verifiable only up to the free-failure paths.
- `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` is already set; if it were absent the two new
  events degrade silently and analytics cannot be claimed verified.

## Non-goals

Scope is Feature 10 only. Explicitly **not** in this change:

- **Server-side filtering, sorting, or pagination** (Feature 11). Those stay client-side
  functions over the array; only the array's origin changes. `PAGE_SIZE` stays 6.
- **A job detail page or clickable rows** (Feature 12). Rows remain non-links.
- **Filling `responsibilities`, `requirements`, `nice_to_have`, `benefits`,
  `about_company`** (Feature 12). Adzuna returns a snippet, not a full posting; these
  stay NULL rather than being invented from it.
- **Company research / `jobs.company_research`** (Feature 13).
- **An `agent_logs` writer** (Feature 13).
- **URL-based manual job import** — out of product scope entirely. `jobs.source` is
  always `'search'` in this change.
- **Scheduled or automatic searches.** Manually triggered only.
- **Adding a test framework.** Verification is `npm run lint`, `npm run build`, a
  manual click-through, and DB assertions through the InsForge MCP.
