## 1. Shared types and utilities

- [x] 1.1 Add `Job` to `types/index.ts`, mirroring the `jobs` table in `db/migrations/001_initial_schema.sql` (id, run_id, user_id, source, source_url, external_apply_url, title, company, location, salary, job_type, about_role, responsibilities, requirements, nice_to_have, benefits, about_company, match_score, match_reason, matched_skills, missing_skills, company_research, found_at), with nullability matching the SQL. Verify `npx tsc --noEmit` reports no error in `types/index.ts`
- [x] 1.2 Add `MatchFilter` (`"all" | "high" | "low"`) and `JobSort` (`"score" | "newest" | "oldest"`) unions to `types/index.ts`, and export the `HIGH_MATCH_THRESHOLD = 70` constant used by both the filter and the score bands so they cannot drift apart. Verify by grepping that no other numeric 70 literal is introduced in `components/find-jobs/`
- [x] 1.3 Create `lib/utils.ts` with `formatRelativeDate(iso: string): string` returning hour/day-granularity relative labels ("2 hours ago", "Yesterday", "3 days ago") and an absolute date beyond ~30 days. No sub-hour granularity — see design.md Decision 5. Verify `npm run lint` passes

## 2. Page shell and mock data

- [x] 2.1 Create `app/(app)/find-jobs/page.tsx` as an async server component: page container `mx-auto max-w-[1440px] px-8 py-8`, `sr-only` h1 "Find Jobs". Verify `/find-jobs` renders instead of 404 and the Navbar item highlights as active
- [x] 2.2 In `page.tsx`, build a 24-entry `Job[]` mock array seeded from the design's companies (Vercel, Stripe, Linear, Notion, OpenAI, Figma, plus 18 more), with a spread of `match_score` values that covers all three bands including at least two below 50, a mix of `source` `"search"` and `"url"`, and `found_at` ISO strings computed once from fixed offsets off a single server-side `now`. Verify by rendering: 24 rows across 4 pages, no hydration warning in the console

## 3. Search controls

- [x] 3.1 Create `components/find-jobs/SearchControls.tsx` (`"use client"`) — Card (surface) with JOB TITLE and LOCATION fields using the documented **Field label** and **Input** classes and the design's placeholders, plus the accent primary button with `Search h-4 w-4`. Verify `npm run lint` passes and the card matches the design's layout
- [x] 3.2 Add the local `searched` boolean and the **success banner** (`rounded-md border border-success-light bg-success-lightest px-3 py-2 text-sm text-success-foreground`, `role="status"`, `Sparkles h-4 w-4`) revealed on submit. No fetch, no server action, no PostHog event. Verify in the browser: banner is hidden on load, appears on click, and `read_network_requests` shows no request fired
- [x] 3.3 Render `SearchControls` from `page.tsx`. Verify the search card sits above the job list, matching the design

## 4. Filter bar

- [x] 4.1 Create `components/find-jobs/JobFilters.tsx` — presentational only, props in and callbacks out, no state. Card (surface) with a text input ("Filter by company or role...") and two native selects using the documented select pattern (`appearance-none pr-9 cursor-pointer` + positioned `ChevronDown h-4 w-4 text-text-muted`), each with an `sr-only` label. Verify `npm run lint` passes and both selects are keyboard-operable

## 5. Jobs table and score bar

- [x] 5.1 Create `components/find-jobs/JobsTable.tsx` (`"use client"`) as the stateful container per design.md Decision 3: owns `query`, `matchFilter`, `sort`, `page`; renders `JobFilters` above the table card. Verify `npm run lint` passes
- [x] 5.2 Implement the derived list — case-insensitive substring match on company or role, match-band filter against `HIGH_MATCH_THRESHOLD`, and the three sort orders — as pure functions over the array so Feature 11 can move them server-side unchanged. Verify in the browser: text filter narrows rows, High Match leaves only ≥70, Low Match only <70, and each sort visibly reorders
- [x] 5.3 Reset `page` to 1 whenever `query`, `matchFilter`, or `sort` changes. Verify: go to page 3, type a filter, and confirm the list shows page 1 rather than an empty table
- [x] 5.4 Render the six-column table with real semantics — `<table>` in an `overflow-x-auto` container, `sr-only` `<caption>`, `<th scope="col">` headers in uppercase 12px `text-text-secondary`, rows separated by `border-b border-border`, no zebra striping, `hover:bg-surface-secondary`, and **no anchor or click handler on the row** (design.md Decision 2). Verify: clicking a row does not navigate
- [x] 5.5 Render each cell — company with a `Building2` tile (`rounded-md bg-surface-secondary`), role, score bar, salary, SOURCE badge using the Source Badge tokens (`bg-accent-muted`/`text-accent` for Search, `bg-surface-secondary`/`text-text-secondary` for URL), and `formatRelativeDate(found_at)`. Verify all six values appear per row
- [x] 5.6 Implement the inline match score bar: 4px `bg-border-light rounded-full` track, fill `bg-success` at ≥70, `bg-warning` at 50–69, `bg-text-muted` below 50, percentage beside it, `role="img"` with an aria-label naming the score. **No blue** — the design PNG's blue bars are the reconciled conflict (design.md Decision 4). Verify with `javascript_tool` reading computed `background-color` on each band, not by eye
- [x] 5.7 Add the empty state shown in place of the table body when the filtered list is empty — muted copy, icon, and a control that clears all filters. Verify: type a filter matching nothing, see the empty state, click clear, and the full list returns at page 1

## 6. Pagination

- [x] 6.1 Create `components/find-jobs/JobsPagination.tsx` — presentational footer inside the table card: "Showing X to Y of N results" on the left, Previous / page numbers / Next on the right using the secondary button classes. Verify `npm run lint` passes
- [x] 6.2 Derive the page count from the filtered total and the page size of 6 — never a hardcoded count (the design's 8 buttons beside "of 24" is inconsistent; see design.md Decision 6). Mark the active page with `aria-current="page"`, and use real `disabled` buttons at the edges, never the retired inert-CTA styling. Verify: footer reads "Showing 1 to 6 of 24", 4 pages render, Previous is disabled on page 1 and Next on page 4, and a filter reducing the total reduces the page buttons

## 7. Documentation

- [x] 7.1 Run `/imprint` to record the three new patterns in `context/ui-registry.md` — success banner, data table (jobs list), and inline match score bar — plus the note that `JobsTable` is the stateful container. Verify the file names all four
- [x] 7.2 Add a one-line clarification to `context/architecture.md` that `JobsTable.tsx` owns list view state and composes `JobFilters` and `JobsPagination`, so the four-file tree is not read as four peers. Verify the note sits with the `find-jobs/` tree entry
- [x] 7.3 Update `context/progress-tracker.md` — check off 09, set Next to "10 Adzuna Job Discovery", and record the four resolved source conflicts under Decisions Made During Build. Verify the Current Status block matches the checklist

## 8. Verification

- [x] 8.1 Run `npm run lint` and `npm run build` and show the output. Both must pass with no new warnings
- [x] 8.2 Run `openspec validate --strict` and show the output
- [x] 8.3 Manual click-through in the browser pane (`preview_start` → `jobpilot-dev` → `/find-jobs`) covering every scenario in `specs/find-jobs/spec.md`: active nav item, banner reveal with no request, text filter, High/Low Match, all three sorts, combined filters, page reset, pagination range and disabled edges, empty state and clear, score-band colours read from computed styles, and a clean console and server log
- [x] 8.4 Check mobile with `resize_window` — the table scrolls inside its own container and the page body does not scroll horizontally
- [x] 8.5 Run `/feature-review` (adversarial by default) and address findings before archiving
