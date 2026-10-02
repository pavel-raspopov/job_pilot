## Why

`/find-jobs` loads **every** saved job in one unpaginated query and then filters, sorts
and pages it in the browser. That was right for Feature 09 (24 hardcoded rows) and
survivable for Feature 10 (a handful of real ones), but the list is now unbounded
history: every search appends up to ten rows and nothing removes them. `page.tsx`
carries no `.limit()` deliberately — a cap would truncate the array while the footer
went on reporting "of N results" from the truncated copy — and its own docblock names
this change as the fix.

The four view values also live in `useState`, so a filtered view cannot be linked,
bookmarked, or reached with the back button. Feature 11 is the last item in Phase 3;
after it, the numbers in the footer come from the same query that produced the rows.

## What Changes

- **The list query moves to Postgres.** `app/(app)/find-jobs/page.tsx` reads
  `q` / `match` / `sort` / `page` from `searchParams` and issues one filtered, ordered,
  counted, ranged PostgREST query. Text search becomes `ilike` on company or title, the
  match bands become `gte` / `or(lt,is.null)`, and the total comes back with the rows.
- **Page size 6 → 20**, per `build-plan.md` Feature 11.
- **The four view values move from `useState` into the URL** — **BREAKING** for
  `JobsTable`'s prop contract, which now receives parsed params plus `totalCount`,
  `rangeStart`, `rangeEnd` and `hasAnyJobs` instead of the full array. A filtered view
  is now linkable and survives a hard reload, which it did not before.
- **New `lib/job-list-params.ts`** — the URL contract in one place: `JobListParams`, the
  defaults, `parseJobListParams()` (zod, garbage falls back to the default rather than
  throwing) and `jobListHref()`. Two consumers, which is what clears
  `architecture.md`'s "no module for a single caller" bar: the server parses, the client
  builds the hrefs the parser must round-trip.
- **Sort order gains a unique final key.** Every row of one search batch shares an
  identical `found_at` (the column defaults to `now()`, which is transaction time), so
  ties are the norm — and `offset`/`limit` over a partial order can repeat a row on page
  2 that already appeared on page 1, or skip one entirely. `id` is appended to all three
  sorts.
- **Windowed pagination.** `JobsPagination` renders first page + a window around the
  current page + last page, with an ellipsis where a gap is elided, matching
  `context/designs/find-jobs.png`. It also gains a `disabled` prop.
- **A list-level pending affordance** — `aria-busy` plus a dimmed table while a
  navigation transition is in flight, and disabled pagination buttons. New visual
  language; the design system has none, so it lands in `ui-registry.md` in this change.
- **Empty-state cause is determined differently.** The old proof of "filters matched
  nothing" was `jobs.length > 0` while the filtered list was empty; no full array
  exists any more. It becomes a truth table over the filtered count and whether filters
  are active, with one extra count-only query in the single ambiguous branch.
- **Bug fix in the rewritten file.** `loadFailed` is currently assigned only *inside*
  `if (user?.id)`, so a failed session read renders "No jobs yet. Run a search above."
  — which the shipped spec forbids ("A load failure is not presented as an empty
  account"). It is set on auth failure too.
- No migration, no new dependency, no new PostHog event.

### Source reconciliation

Six conflicts between the sources, each resolved here rather than left for Feature 12:

| Conflict | Resolution |
|---|---|
| `memory.md` and `progress-tracker.md` assign job **deduplication** to Feature 11; `build-plan.md` Feature 11 does not mention it | **Out of this change.** Dedup cannot live in the list query at all: `distinct on` is not expressible through PostgREST, and `count: "exact"` would count pre-dedup rows while `.range()` sliced post-dedup ones, so the footer would lie and page boundaries drift. It is a write-path change to `POST /api/agent/find` and becomes the next change. Developer confirmed |
| `library-docs.md` § DB Queries writes `insforge.from("jobs")`; § Storage writes `insforge.database.from(...)` — the file contradicts itself | **`insforge.database.from`**, which both shipped routes and both shipped pages already use. Correct the doc |
| `library-docs.md` documents none of `.range()`, `count: "exact"`, `.or()`, `.ilike()`, `nullsFirst` — every one of which this change needs | Its own authority order puts the InsForge MCP above it. All five confirmed via `fetch-sdk-docs db typescript` and the installed `@supabase/postgrest-js@1.21.4` typings. Add the patterns to the doc so the next feature does not re-derive them |
| The shipped `find-jobs` spec says Low Match leaves only jobs "scoring below 70", but the implementation puts **unscored** jobs there (the client coerces `null` to 0) | **Preserve the behaviour, amend the wording.** The bands must partition the list — Feature 10 degrades a failed scoring run to saved-but-unscored rows, and those must not vanish from both bands. The scenario becomes "no remaining job scores 70 or above" |
| `JobsPagination`'s recorded decision is one button per page and no ellipsis; `context/designs/find-jobs.png` draws `Previous ǀ 1 2 3 … 8 ǀ Next` | **The design asset wins**, which is also the project's default precedence. The recorded reason ("the count here never exceeds four, so truncation would be unexercisable code") was computed against a capped 24-row mock; over unbounded history it expires, and seeded rows make the control exercisable |
| `ui-registry.md` says the score bar's track carries `role="img"` and an `aria-label`, and that `SearchControls` is "given `userId`" | Both are stale — Feature 10's review made the bar `aria-hidden="true"` and removed the prop. Correct the doc while in the file |

## Capabilities

### New Capabilities

None. This change alters how an existing capability behaves; it introduces no new one.

### Modified Capabilities

- `find-jobs`: three requirements change behaviour.
  **Filtering, searching, and sorting the job list** — the filter, band and sort are now
  addressable in the URL and applied by the database, ordering is fully specified
  (including where unscored jobs land), and `*` in the text filter acts as a wildcard.
  **Job list pagination** — twenty per page, a windowed control with an ellipsis, an
  out-of-range page clamped to the last page, and a total that is the filtered count from
  the query rather than the length of an array.
  **Empty job list state** — the three causes are unchanged, but how the system tells
  them apart is now a stated requirement rather than a consequence of holding the whole
  list.

## Impact

**New:** `lib/job-list-params.ts`.

**Modified:** `app/(app)/find-jobs/page.tsx` (parses `searchParams`, owns the query,
computes the range and the empty-state cause), `components/find-jobs/JobsTable.tsx`
(state → props, becomes the URL's sole writer, pending affordance),
`components/find-jobs/JobsPagination.tsx` (windowed pages, `disabled`),
`types/index.ts` (`JobListParams`).

**Unchanged:** `components/find-jobs/JobFilters.tsx` and `SearchControls.tsx`. The
four-exported-file constraint on `components/find-jobs/` holds — no fifth file, and
`architecture.md` already says this change alters "where the array comes from and where
the three values are held, not the component split". `SearchControls`' `router.refresh()`
re-requests the current URL, so the Feature 10 decision that a search preserves the
user's filter, sort and page holds without touching it.

**Docs:** `context/progress-tracker.md`, `context/ui-registry.md`,
`context/architecture.md`, `context/library-docs.md`, `context/build-plan.md` (the dedup
move), `memory.md`.

**Dependencies:** none added. The debounce is a `setTimeout` in a ref.

**Database:** no migration. Both existing indexes stay useful for the leading sort key;
appending `id` means neither supplies the full ordering, and Postgres sorts within ties —
irrelevant at tens of rows per user, but it should not be claimed otherwise.

### Human gates

- **No new secrets.** `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` and the InsForge variables are
  already present; this change reads the database and adds no provider call.
- **One real billed search** closes the verification (a search must still land in the
  list without disturbing the active filter). It needs the existing Adzuna and InsForge
  gateway credentials; if they were absent, everything except that final step is still
  verifiable from seeded rows, and no end-to-end claim would be made.
- **Verification requires the developer to sign in** in the Browser pane — it starts with
  no session, and `/find-jobs` is behind `proxy.ts`.
- **`count: "exact"` is a hard dependency to probe before any UI is written.** The number
  is parsed from the `content-range` *response header*, not the body. If that header does
  not survive the InsForge proxy, `count` is silently `null`, the footer reports a bogus
  total and page 2 becomes unreachable. Task 1 verifies it and names the fallback.

## Non-goals

Scope is Feature 11 only. Explicitly **not** in this change:

- **Deduplication of `jobs`** — the next change, for the reason in the table above.
- **A job detail page or clickable rows** (Feature 12). Rows stay non-links; the
  destination does not exist yet.
- **Filling `responsibilities`, `requirements`, `nice_to_have`, `benefits`,
  `about_company`** (Feature 12). Still NULL.
- **Company research / `jobs.company_research`** (Feature 13).
- **Any new PostHog event.** `code-standards.md` fixes the project at four, and a
  filter or page change is not one of them. A query-only URL change must also fire no
  `$pageview` — verified, not assumed.
- **A `match_score_effective` generated column.** It would delete the null-band `or()`,
  the `nullsFirst` question and a whole bug class in one migration, but it moves the
  `?? 0` policy out of TypeScript — where `HIGH_MATCH_THRESHOLD` is the single
  definition of this boundary — into the schema, where a later feature is free to
  disagree with it. Recorded as an escape hatch, not taken.
- **A `loading.tsx` or Suspense boundary.** A `useTransition` keeps the current rows on
  screen; a skeleton would replace correct data with a placeholder.
- **Deleting or archiving saved jobs.** No delete path exists, which is also why an
  out-of-range page is rare.
- **Adding a test framework.** Verification is `npm run lint`, `npx tsc --noEmit`,
  `npm run build`, a manual click-through, and SQL assertions through the InsForge MCP
  used as an independent oracle for the counts and the ordering.
