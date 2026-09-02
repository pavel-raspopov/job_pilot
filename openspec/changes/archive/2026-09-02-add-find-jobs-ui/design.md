## Context

See `proposal.md` — Why. The relevant constraints for the approach:

- `context/architecture.md` fixes the component tree under `components/find-jobs/` at exactly
  four files: `SearchControls.tsx`, `JobsTable.tsx`, `JobFilters.tsx`, `JobsPagination.tsx`.
  A review in Feature 01 found components that had drifted from that tree and merged them
  back; Feature 05 declined to invent a banner component for the same reason.
- `context/ui-registry.md` already documents the card, label, input, select, primary and
  secondary button, and badge patterns this page needs. Three patterns are genuinely new.
- The page renders fixed sample data now and a `jobs` query in Feature 10/11. The shape of
  the seam between "where the rows come from" and "how they are shown" is the main design
  decision here.
- The repo has no test runner. Correctness is established by lint, build, and a manual
  click-through — so behaviour that is easy to get subtly wrong (hydration, page-reset)
  needs to be designed out rather than tested for.

## Goals / Non-Goals

**Goals:**

- Put the data source behind a single seam so Feature 10/11 swaps it without touching
  presentation.
- Stay inside the four-file component tree.
- Reuse the documented UI patterns exactly; add only the three that do not exist.
- Make the mock honest: full `Job` records, a real derived page count, real relative dates.

**Non-Goals:**

- URL-persisted filter state (`?q=&filter=&sort=&page=`). Feature 11 moves querying to the
  server and will want searchParams then; adding it now builds a router round-trip into a
  page with no server data to fetch.
- A generic reusable table or pagination abstraction. One caller exists.
- Any visual exploration — `/impeccable shape` is not needed here because every visual
  decision was closed before this change was written (see Decisions 1 and 4).

## Decisions

### 1. Six columns, not the design's five

`context/build-plan.md` Feature 09 and `context/project-overview.md` both list a SOURCE
badge; `context/designs/find-jobs.png` draws only COMPANY, ROLE, MATCH SCORE, SALARY EST.,
DATE FOUND.

The project's default is that the design asset wins (Feature 05's cover-letter-tone
dropdown was dropped on exactly that basis). **The developer overrode the default here:
six columns, SOURCE included.** Recorded because it inverts the usual precedence — the
reasoning is that `jobs.source` is a real, already-migrated column with a documented badge
token pair, and Feature 10 writes `'search'` while a later URL-paste flow writes `'url'`;
the distinction is meaningful to the user and the design simply predates it.

Alternative considered: follow the design and add the column in Feature 10. Rejected — it
would mean rebuilding the table header and row a week later for a column already specified
twice.

### 2. Rows have a hover state but are not links

`project-overview.md` says clicking a row opens the job details page, which is Feature 12.
Linking now ships a control that 404s. The project already carries one instance of that
(the dashboard's `/profile` link, deferred as tech debt #10) and it was noise every time
someone clicked it.

Chosen: the documented `bg-surface-secondary` row hover only, with no anchor and no click
handler. Feature 12 adds the link when `/find-jobs/[id]` exists.

Alternative considered: link now and accept the 404. Rejected — a spec scenario asserting
"clicking a row navigates to a page that does not exist" is not a contract anyone can
satisfy.

### 3. `JobsTable` is the stateful container

Filter, sort, search, and pagination all read one derived list, so exactly one component
must own that state. The natural instinct is a fifth `JobsList.tsx` wrapper, which would
contradict `architecture.md`'s four-file tree.

Chosen: `JobsTable.tsx` is a `"use client"` container. It owns `query`, `matchFilter`,
`sort`, and `page`; derives the filtered-sorted-sliced list; and composes `JobFilters`
above the table card and `JobsPagination` inside the table card's footer. `JobFilters` and
`JobsPagination` stay presentational — props in, callbacks out, no state of their own.

This is deliberately recorded in `ui-registry.md` and `architecture.md` because the name
undersells the role: a reader expecting `JobsTable` to render only a `<table>` will be
surprised.

Alternative considered: make `page.tsx` a client component and own the state there.
Rejected — Feature 10/11 need the page to be a server component reading `jobs` for the
signed-in user, so the state would have to move out again immediately.

### 4. Score bands come from `ui-tokens.md`, not from the design PNG

The design paints the 88% and 85% bars blue. `context/ui-tokens.md` and
`context/ui-rules.md` both specify green from 70. This was already reconciled on
2026-07-31 (`progress-tracker.md`) in favour of the tokens, because the green boundary at
70 is the same boundary as the High Match filter (`match_score >= 70`, `build-plan.md`
Feature 11) — a user who filters to High Match should see exactly the green rows.

So: `bg-success` at 70+, `bg-warning` at 50–69, `bg-text-muted` below 50, track
`bg-border-light`, 4px tall, `rounded-full`. **No blue.** This is worth verifying by
reading the computed `background-color`, not by looking at the page — the whole point is
that the design asset says otherwise.

### 5. The mock array lives in the server page, and dates are computed once

`page.tsx` is an async server component that builds 24 `Job` records and passes them to
`JobsTable`. Feature 10/11 replaces the array literal with an InsForge `jobs` select; every
component below it is unchanged.

`found_at` values are ISO strings computed **once on the server** from fixed offsets and
passed down as data. The client formats those same strings. If instead the client derived
"hours ago" from its own clock against a server-rendered baseline, the server and client
could format the same job differently and React would report a hydration mismatch.
Formatting at hour/day granularity makes the two renders identical in practice.

Alternative considered: a `lib/mock-jobs.ts` module. Rejected — a non-component `.ts` file
under `components/find-jobs/` muddies the four-file tree, and a `lib/` module for throwaway
data outlives its usefulness by pretending to be infrastructure. Keeping it inline in the
page makes it obvious what Feature 10 deletes.

### 6. Page size is 6 here and 20 in Feature 11; the page count is derived

The design footer reads "Showing 1 to 6 of 24" beside page buttons numbered up to 8, which
is internally inconsistent — 24 items at 6 per page is 4 pages. The page count is computed
from the filtered total, never hardcoded, and the mock therefore renders 4 pages.

Six per page is kept for this change so the page matches the design's row density.
`build-plan.md` Feature 11 raises it to 20 alongside server-side querying; that is a
one-constant change.

### 7. Search is local state on `SearchControls`

The Find Jobs button flips a local `searched` boolean that reveals the success banner. No
fetch, no server action, no PostHog event. Feature 10 replaces the boolean with the result
of `POST /api/agent/find` and fires `job_search_started`.

Because there is no request, the in-flight `useRef` guard that Features 07/08 established
for billed actions does not apply yet. **It becomes mandatory the moment Feature 10 wires
this button to the gateway** — see the "Routes that call the AI gateway" section of
`context/code-standards.md`.

### 8. Filters use the documented native select pattern

`ui-registry.md` documents selects as native `<select>` with `appearance-none pr-9` and a
positioned `ChevronDown`. The design's dropdowns read as buttons, but a custom listbox
would be new keyboard and focus behaviour for no functional gain, and `ProfileForm`'s
`SelectField` already sets the precedent. Each select gets an `sr-only` label — the filter
bar shows no visible labels.

## Files in scope

**Editable:** `app/(app)/find-jobs/page.tsx`, the four `components/find-jobs/*` files,
`lib/utils.ts`, `types/index.ts`, and the three `context/` docs listed in the proposal's
Impact section.

**Frozen:** everything else, and specifically `app/globals.css` (every token this page needs
already exists — `success`, `warning`, `text-muted`, `border-light`, `accent`,
`surface-secondary`, `accent-muted`), `middleware.ts` (`/find-jobs` is already protected),
`next.config.ts`, `components/layout/*`, and all of `components/profile/*`. One-line
type or compile fixes only, and only if `npm run build` names the file.

## Risks / Trade-offs

- **Hydration mismatch on relative dates** → Timestamps are computed once on the server and
  passed as data; formatting is hour/day granularity so both renders agree. Verified by a
  clean console on load.
- **`JobsTable` owning filter state reads as a naming smell to a future reviewer** →
  Recorded explicitly in `ui-registry.md`, `architecture.md`, and Decision 3, with the
  four-file constraint as the stated reason.
- **The six-column table overflows narrow viewports** → `overflow-x-auto` on the table's own
  container, verified at mobile width with no horizontal scroll on the page body.
- **Feature 11 has to move filtering from client to server** → Accepted deliberately. The
  filter/sort/paginate logic is pure functions over an array, so the move is replacing where
  the array comes from and lifting three values into searchParams — not a rewrite of the
  components.
- **Mock data can quietly outlive its welcome** → It sits in `page.tsx`, the exact file
  Feature 10 edits first, rather than in a `lib/` module that could be forgotten.
- **Shipping the design's blue bars by accident** → The verification step reads computed
  `background-color` rather than trusting a visual check, because the binding design asset
  disagrees with the tokens here.
