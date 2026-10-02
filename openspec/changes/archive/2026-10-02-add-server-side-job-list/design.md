## Context

Feature 09 built the job list's filter, sort and pagination as **plain functions over an
array** — `matchesQuery`, `matchesBand`, `selectJobs` — precisely so this change would be a
swap of where the array comes from rather than a rewrite of the components around it.
`context/architecture.md` states the same expectation: Feature 11 changes "where the array
comes from and where the three values are held, not the component split."

That holds. `JobFilters.tsx` and `SearchControls.tsx` are untouched; `JobsTable.tsx` keeps
its markup, its local helpers and its three-way empty state and loses only the four
`useState` values and the four array helpers.

What does not hold is the assumption underneath the old design. The list is unbounded
history, so the array cannot be fetched whole; and once the server slices it, four things
that were previously free have to be built deliberately: a **total** order (so paging
cannot repeat or skip a row), a null-safe band filter, an escaped text filter, and a
replacement for the proof-by-array that told `no-jobs` apart from `no-matches`.

One dependency is verified before anything else is written. `count: "exact"` in
`postgrest-js` sends only a `Prefer: count=exact` request header; the number is parsed from
the **`content-range` response header**. If that header does not survive the InsForge proxy,
`count` is `null`, the footer reports a bogus total and page 2 is unreachable — a silent,
plausible-looking break. Task 1 probes it.

### Files in scope

- `lib/job-list-params.ts` — **new.** The URL contract.
- `app/(app)/find-jobs/page.tsx` — parses `searchParams`, owns the query, computes the
  range and the empty-state cause.
- `components/find-jobs/JobsTable.tsx` — state to props; becomes the URL's sole writer.
- `components/find-jobs/JobsPagination.tsx` — windowed page list, `disabled` prop.
- `types/index.ts` — `JobListParams`.
- Docs: `context/progress-tracker.md`, `context/ui-registry.md`,
  `context/architecture.md`, `context/library-docs.md`, `context/build-plan.md`,
  `memory.md`.

### Files frozen

`components/find-jobs/JobFilters.tsx`, `components/find-jobs/SearchControls.tsx`,
`app/api/agent/find/route.ts`, `agent/*`, `lib/parse-job.ts`, `lib/utils.ts`,
`lib/ai-rate-limit.ts`, and every migration under `db/migrations/`. One-line type or
compile fixes only, and only if `npm run lint`, `npx tsc --noEmit` or `npm run build`
fails. No behaviour changes.

`lib/utils.ts` deserves a note: `HIGH_MATCH_THRESHOLD` gains a third reader (the query) and
its value must not move. `scoreBandClass` in `JobsTable` keeps importing it, which is what
keeps the green bar and the High Match filter provably the same boundary.

## Goals / Non-Goals

**Goals**

- The footer's total, the ordering and the rows all come from one query over all of the
  user's matching jobs.
- Twenty per page.
- A filtered view is linkable, bookmarkable, reload-safe, and reachable with the back
  button.
- Paging is deterministic: no row on two pages, none skipped, even when `found_at` ties.
- Every observable behaviour the shipped spec requires survives — the three-way empty
  state, the provider credit, genuinely disabled edge controls, page-1 reset on a filter
  change, and a search preserving the user's view.

**Non-Goals**

- Deduplication of `jobs`. It cannot live here: `distinct on` is not expressible through
  PostgREST, and a pre-dedup `count` beside a post-dedup `range` would make the footer lie.
  Next change, on the write path.
- Row links, the job details page, company research, the five unfilled columns.
- Any new PostHog event, and any `$pageview` on a query-only URL change.
- A test framework.
- A schema change of any kind.

## Decisions

### D1. The URL is the list's state, and one module owns the contract

Four values (`q`, `match`, `sort`, `page`) move from `useState` into `searchParams`. That
is what makes a filtered view shareable and reload-safe, and it is what lets
`SearchControls`' existing `router.refresh()` preserve the user's view for free — it
re-requests the current URL, so the server re-runs the identical query.

Both halves of the contract live in **`lib/job-list-params.ts`**: `parseJobListParams()`
(server) and `jobListHref()` (client). `architecture.md` forbids a `lib/` module for a
single caller — the rule that left `agent/types.ts` and `ResumePreview.tsx` unbuilt — and
this one clears the bar with two. Splitting them would put the param names and defaults in
two files, which is the defect class the Phase 2 review caught in `renderableRoles`: one
contract, two derivations, free to drift.

The **query** is not in that module. It has one caller, invoked twice, so it is a local
unexported `loadJobsPage()` in `page.tsx` — the same shape as `finishRun` in the find
route.

### D2. `PAGE_SIZE` stays in `page.tsx`, and the server passes the range down

Tempting to put it beside `HIGH_MATCH_THRESHOLD` in `lib/utils.ts`. It does not qualify.
That constant is shared because two consumers describe the *same boundary*; `PAGE_SIZE`
after this change has exactly one reader — the server, which uses it for `.range()` and
then hands the client `totalPages`, `rangeStart` and `rangeEnd` as facts.

Passing those three rather than the page size is the mechanism that keeps it single-caller,
and is the honest reason for the extra props. A client that derived them would be a second
place where "twenty" is encoded.

### D3. The ordering must be total, so `id` is the last key

Every row of one search batch shares an identical `found_at`: the column defaults to
`now()`, which is transaction time, and all ten rows go in one `insert([...])`. Ties are
therefore the **normal case**, not an edge case.

`offset`/`limit` over a partial order is not stable — the database may satisfy two requests
with different orderings of the tied group, so a row on page 1 can reappear on page 2 while
another is never shown. Nothing about the page would look wrong. So every sort ends with
`id`:

```ts
// score
.order("match_score", { ascending: false, nullsFirst: false })
.order("found_at",    { ascending: false })
.order("id",          { ascending: false })

// newest / oldest
.order("found_at", { ascending })
.order("id",       { ascending })
```

`postgrest-js` accumulates repeated `.order()` calls into one comma-joined `order=`
parameter, so this is a single multi-key ordering.

Two honest consequences. The `found_at` key in the score sort is not decoration either — it
reproduces what `Array.prototype.sort`'s stability used to give for free over an array that
arrived `found_at desc`, namely equal scores coming out newest-first. And appending `id`
means neither existing index supplies the full ordering; Postgres sorts within ties. At
tens of rows per user that is irrelevant, but the comment must not claim the index is doing
the ordering.

### D4. Unscored jobs stay in the low band

The client coerced `null` to 0, so a job whose scoring failed appeared under Low Match.
SQL does not agree by default: `.lt("match_score", 70)` drops nulls, and `order … desc`
puts them **first**. Both are corrected explicitly:

```ts
query.or(`match_score.lt.${HIGH_MATCH_THRESHOLD},match_score.is.null`)   // low band
query.order("match_score", { ascending: false, nullsFirst: false })      // score sort
```

(As shipped, the low-band group shares one `or=` with the text group — see D6 results.)

Keeping the behaviour matters more than it looks: Feature 10 degrades a failed scoring run
to saved-but-unscored rows, and if those fell out of both bands a user filtering by band
would never see jobs that are really there. The bands must partition the list. The high
band needs nothing — `NULL >= 70` is `NULL`, so unscored rows drop out on their own, which
is what `(match_score ?? 0) >= 70` did too.

This makes the shipped spec scenario ("every remaining job has a match score below 70")
literally false for unscored rows — so today's *behaviour* was already in tension with the
spec *text*. The delta amends the wording rather than quietly changing what users see.

### D5. The text filter crosses two parsers, so it is escaped in two ordered layers

`.or()` hands its argument to PostgREST verbatim — the library says so ("you need to make
sure they are properly sanitized"). PostgREST's filter parser treats `,` `.` `:` `(` `)`
structurally, protected by double-quoting the value, inside which `"` and `\` are
backslash-escaped. Then SQL `LIKE` treats `%` `_` `\` as metacharacters. Every backslash
produced for the SQL layer has to survive the quoting layer, so it gets doubled — and the
order matters, because escaping after adding our own `%` would escape those too:

```ts
function containsPattern(needle: string): string {
  const likeSafe = needle.replace(/[\\%_]/g, (char) => `\\${char}`);   // 1. SQL LIKE
  const quoteSafe = likeSafe.replace(/["\\]/g, (char) => `\\${char}`); // 2. PostgREST quotes
  return `%${quoteSafe}%`;                                             // 3. our wildcards
}
```

Percent-encoding is free: `postgrest-js` writes into `url.searchParams` and the InsForge
shim forwards `urlObj.search` byte-for-byte.

Getting this wrong is **not** a security hole — the group is ANDed with
`user_id=eq.<id>` and gated again by RLS, so the worst case is a 400 that the page reports
as "Could not load your jobs". But that is a 400 on every keystroke for a user filtering on
"Smith, Jones", which is why it is verified against an independent oracle (D6) rather than
reasoned about.

**One accepted divergence: `*` acts as a wildcard.** PostgREST rewrites `*` to `%` in a
like/ilike pattern before Postgres sees it, so it cannot be escaped away. It widens the
user's own filter and can never reach another user's rows, so it degrades safely — recorded
in the spec rather than hidden in a comment. **Observed 2026-09-24:** `?q=Eng*38` returned
the one "Engineer 38" row where the literal `position()` oracle returns none, so `*` does
widen the match, as expected. If exact `String.includes` semantics ever
matter, the fallback is `imatch` (`~*`) with regex metacharacters escaped: one conceptual
layer, no wildcard rewrite, and no backtracking risk because a fully-escaped literal
contains no quantifiers.

### D6. Three backend facts are probed before any UI is written

Reading the library tells us what it *sends*; only the live backend tells us what comes
back. Task 1 implements the query with a temporary log and checks:

1. **`count` is a number.** If `content-range` is stripped, the whole count strategy has to
   change (a separate count query, or an RPC) and this design needs revising. The code
   falls back to `total ?? jobs.length`, which under-reports rather than showing "of 0
   results" beside twenty visible rows, and logs loudly.
2. **Two `or=` parameters AND.** Only exercised with a text filter *and* the low band
   together. `postgrest-js` uses `searchParams.append`, so they emit as `or=(…)&or=(…)`
   and PostgREST ANDs top-level parameters — likely, but worth sixty seconds. Fallback: one
   `.or()` in disjunctive normal form, four `and(...)` groups, no dependence on
   repeated-key semantics.
3. **The escaping holds** for `,` `%` `_` `\` `"` `(` `)` `.` `:` and a space — against a
   SQL oracle using `position(lower(needle) in lower(coalesce(company,'')))`, which has no
   wildcards and therefore *is* `String.includes`. Record what `*` does.

**Results (2026-09-24, 46 seeded rows):**

1. **`count` arrives.** 46 on the unfiltered page, alongside 20 rows. `content-range`
   survives the proxy; no fallback needed.
2. **Two `or=` parameters do not AND — they fail.** Every text filter combined with Low
   Match returned PGRST100, `failed to parse filter ((company.ilike…))`, "expecting not or
   operator". The SDK forwards the query string untouched, so the repeated key is lost
   inside the InsForge records endpoint before PostgREST parses it; the exact rewrite is
   not visible from here. It failed loudly rather than returning a wrong count.
   **Fallback taken, in a variant of the form named above:** one `or=` whose single member
   is `and(or(<text>),or(<band>))`, rather than four flat `and(...)` groups. Same property —
   one key, no repeated-key semantics — but each clause is written once, and every text
   search goes through the same nested syntax, so the escaping matrix below exercises the
   path the combination uses rather than a separate one.
3. **The escaping holds.** 22 needles × 3 bands = 66 requests, all matching the
   `position()` oracle, and `high + low = all` for every needle. That includes each
   metacharacter *alone*, which is the discriminating form: `%` and `_` return 1 row, not
   the 46 a wildcard would match. The single expected divergence is `*` (D5).

### D7. The empty-state cause is a truth table, plus one conditional probe

The old proof — `jobs.length > 0` while the filtered list is empty — is gone. With
`filtersActive = q !== "" || match !== "all"` (sort never narrows):

| | `total > 0` | `total === 0` |
|---|---|---|
| `!filtersActive` | `hasAnyJobs = true` | `hasAnyJobs = false` — with no filters the filtered count **is** the account total. Free. |
| `filtersActive` | `hasAnyJobs = true` — visible rows are a subset of the account's | **ambiguous** — the only branch that costs a query |

So one extra round trip, in the one branch where the user is already looking at an empty
table: `.select("id").eq("user_id", …).limit(1)`. Deliberately *not*
`{ count: "exact", head: true }` — the question is a boolean, and this avoids depending on
the same `content-range` header and on a HEAD request through the proxy for what is itself
an edge case.

On probe error, return `true`. We are only there with filters active, so "no jobs match the
current filters" is true either way and offering to clear them is never nonsense; claiming
the account is empty could be false, would tell a user with forty saved jobs to run their
first search, and would drop the provider credit the API terms require.

The variant becomes `loadFailed ? "load-failed" : hasAnyJobs ? "no-matches" : "no-jobs"` —
same precedence as today, with `jobs.length === 0` swapped for `!hasAnyJobs`. That is
*stronger* than testing whether filters are active: a user with no saved jobs who types in
the filter box correctly gets "run a search" rather than a Clear button that would produce
nothing. The credit reads the same boolean, so one probe answers both.

### D8. An out-of-range page is clamped and re-queried, not redirected

```ts
let result = await loadJobsPage(insforge, userId, params);
const total = result.total ?? result.jobs.length;
const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
const page = Math.min(params.page, totalPages);
if (page !== params.page && total > 0) {
  result = await loadJobsPage(insforge, userId, { ...params, page });
}
```

A redirect cannot be cheaper: the page is only known to be out of range *after* a completed
query, so `redirect()` costs a whole second render — auth read included — where the clamp
costs one extra query, and only in the rare case. A redirect can also re-target out of
range if rows vanish between the two requests. And `redirect()` throws `NEXT_REDIRECT`,
which is a live footgun next to code that has error handling around the query — the
`(auth)/callback` page already carries that scar.

**Corrected during apply (2026-09-24): the first query usually cannot say where the end
is.** The snippet above assumes an out-of-range request still returns a count. It does
not: PostgREST answers an offset *past* the last row with **416, PGRST103 "Requested range
not satisfiable"**, and `postgrest-js` parses `count` only inside `if (res.ok)`
(`PostgrestBuilder.js:78`). Shipped as written, `?page=99` rendered "Could not load your
jobs". So `loadJobsPage` reports PGRST103 as `outOfRange` rather than `failed`, and the page
then asks for **page 1** — offset 0 is satisfiable even over zero rows — whose count names
the last page; the snippet's clamp then fetches it if it is not page 1. The clamp is kept,
not replaced, because an offset landing *exactly* on the total is not a 416: `?q=engineer`
matches 40 rows, and `page=3` (offset 40) came back 200, empty, with `count: 40`.

Measured cost: an in-range page, zero extra queries. `?page=99` over 46 rows, two (page 1,
then page 3). Over 7 rows, one (page 1 is the last). A filter matching nothing on `page=5`,
one (page 1, found empty — no last-page fetch) plus the D7 probe. Still no redirect.

Everything rendered is built from the **clamped** page — the stated range, `aria-current`,
every generated href — so the first interaction rewrites the URL. The residue is a URL
reading `page=99` while page 3 is shown, until the next click. Reachable causes are a
hand-edited URL, a stale bookmark, and Back after a narrowing filter; a search only ever
*adds* rows, so `router.refresh()` can never shrink the page count.

### D9. `JobsTable` stays the single client container; pagination stays buttons

The alternative — a server-rendered table with `<Link>` controls — fails two project rules.
The `<select>`s apply on change with no Apply button, which needs JS, and under the
four-exported-file cap the only home for it is `JobFilters.tsx`, which `architecture.md` and
`ui-registry.md` both pin as presentational, props-in/callbacks-out. And the shipped spec
requires disabled pagination controls to be *genuinely* disabled, which an `<a>` cannot be;
mixing `<button disabled>` at the edges with `<a>` in the middle is the inconsistency the
retired "Inert primary CTA" entry warns against.

So pagination keeps `onPageChange` and loses middle-click. That is the price of the spec's
disabled requirement, taken knowingly.

`JobsTable` receives parsed values as props and never calls `useSearchParams()` — Next's own
recommendation, and it sidesteps every prerender and Suspense question. `usePathname()`
supplies the href base, precedented in `components/layout/NavbarNav.tsx`.

### D10. The text input keeps a local draft, and resyncs only when the URL moves on its own

The input is driven by local `queryDraft` state so typing never waits for a round trip; an
`intended` ref records what this component last asked the URL to be, updated
**synchronously** in every handler so a band or sort change during the debounce window
carries the newest text rather than reverting to what the URL still says. The debounce is a
`setTimeout` in a ref with unmount cleanup — no new dependency.

Back and Forward would otherwise leave the input showing text that does not match the rows.
So `queryDraft` resyncs from props when, and only when, **no debounce timer is armed**,
`!isPending`, and the props differ from `intended` — a conditional `setState` during render
(React's documented "adjust state when a prop changes"), not an effect. Both in-flight
guards are load-bearing: after our own navigation lands, the props are one step behind
whatever has been typed since, and resyncing then would delete it.

**Corrected during apply (2026-09-24), two details, same behaviour.** (1) `intended` and
"a debounce is armed" are **state**, not refs: the resync reads both during render, and
`eslint-config-next` ships `react-hooks` 7 with `react-hooks/refs`, which forbids that. The
timer id itself stays in a ref, touched only by handlers and the unmount cleanup; the
"armed" flag is cleared *inside* the navigation's transition so it commits together with the
new rows, leaving no render where both guards are down while props trail the text.
(2) The comparison runs through **`normalizeQuery`**, exported from `lib/job-list-params.ts`
and used by the parser itself. Comparing the raw draft against the parsed `q` would have
deleted a trailing space mid-phrase: pause after "senior ", the URL comes back `q=senior`,
the difference reads as an outside change, and the space the user was about to follow with
"dev" disappears. Verified live: the space survives the round trip.

**Corrected after review (2026-10-02), two edges the timer had.** (1) **A navbar link
clicked inside the 300 ms window was lost** — reproduced 3/3: the link starts navigating,
the timer then fires its `replace`, and Next abandons a pending navigation for the newer
one, so the user stays on `/find-jobs?q=…`. The waiting text is now sent the moment the
filter box loses focus; clicking a link moves focus on mousedown, so ours becomes the older
navigation and the link's wins. (2) **Back inside the window** (the "micro-edge" below) did
worse than re-apply the filter: the `replace` overwrote the history entry Back had just
landed on. A `popstate` listener now cancels the waiting debounce.

Traced: Back/Forward resyncs; a second keystroke burst arriving while the first navigation
is in flight does not lose the newer characters; the D8 clamp (props say page 3, intended
says 99) is adopted; `SearchControls`' `router.refresh()` changes nothing and leaves the
draft alone. One known micro-edge, not worth code: pressing Back inside the 300 ms window
lets the debounce fire and re-apply the typed filter.

### D11. `replace` while typing, `push` for everything else

Typing uses `router.replace`: one history entry per keystroke burst would make Back
useless — a user would press it a dozen times to leave the page — and the debounce means
the final text is what lands in the entry. The band, the sort, the page and Clear use
`router.push`, because each is one deliberate act that Back should undo. Every navigation
passes `{ scroll: false }`.

This is a new convention; the repo has no prior URL-state component. `replace` everywhere is
equally defensible and equally common.

### D12. The pending affordance reuses existing vocabulary; no spinner, no skeleton

Nothing in `ui-rules.md`, `ui-tokens.md` or `ui-registry.md` covers a list-level busy
state, and doing nothing is not an option — on a cold serverless request, Next with no
feedback gets clicked twice. Rather than invent a visual language:

- `aria-busy={isPending}` and `opacity-60` with `transition-opacity` on the table
  `<section>`. `opacity-60` is *already* this project's "not currently actionable" signal —
  it is in `disabled:opacity-60` on every button class in the registry — and opacity is not
  a colour token, so the token rule is untouched.
- `disabled={isPending}` on the pagination buttons, which already carry
  `disabled:opacity-60 disabled:cursor-not-allowed`. This also kills
  double-click-skips-a-page.
- The `<select>`s are **not** disabled: going inert mid-interaction is jarring, and a second
  change simply supersedes the first, which transitions handle.
- The text input is **never** disabled. That is the entire point of the local draft.
- No spinner (`ui-registry.md`: "Never show a spinner-only state"), no skeleton, and no
  `loading.tsx` — a `startTransition` keeps the correct rows on screen, and a Suspense
  fallback would replace real data with a placeholder. Recorded as a decision so a later
  feature does not read the absence as an oversight.

This is a design-system addition and lands in `ui-registry.md` in this change, or it is
drift.

**Corrected after review (2026-10-02): `aria-busy` does not announce.** It tells assistive
technology to *hold back* changes inside the element until it clears, so on its own it left
the spec's "SHALL announce that state" unmet — a screen-reader user changing the sort heard
nothing. An always-mounted `role="status"` `sr-only` paragraph now reads "Updating
results…" while pending. It sits outside the busy section, because inside it its own text
change would be held back as well.

### D13. Windowed pagination — the design asset wins, and the old reason has expired

`JobsPagination`'s recorded decision was one button per page, no ellipsis, because "the
real count here never exceeds four, so truncation would be unexercisable code, and
unverifiable code is worse than none". That premise was a capped 24-row mock. Over
unbounded history it fails — a year of searching is 300+ saved jobs, fifteen page links —
and seeded rows now make the control exercisable, so the objection is gone on both counts.
`context/designs/find-jobs.png` draws `Previous ǀ 1 2 3 … 8 ǀ Next`, and the design asset
winning is the project's default precedence.

A local unexported `pageWindow(page, totalPages)` returns page numbers and elision markers:
always the first page, the last page, and a window around the current one. At page 1 of 8
that is `1 2 3 … 8`, matching the asset.

### D14. Garbage in the URL falls back to the default; it never throws

`searchParams` is untrusted request input a user can typo or hand-edit, which is the layer
where this repo already uses zod (`bodySchema` in the find route); the hand-rolled parsers
in `lib/parse-job.ts` exist only because the SDK types DB rows as `any`. So: zod with
`.catch(default)` per field, which states the fallback rule next to the field it governs.

`q` over 100 characters is **truncated, not rejected** — dropping a long filter silently
widens the list, which is the worse failure. 100 matches the find route's own
`z.string().trim().max(100)`. `page` is capped at parse time so `(page - 1) * PAGE_SIZE`
cannot leave safe-integer range; the count-based clamp in D8 finishes the job. Unknown
parameters are ignored and never echoed into a generated href, so nothing user-controlled is
reflected back into a link.

### D15. A failed session read is a load failure, not an empty account

Pre-existing bug in the file being rewritten: `loadFailed` is assigned only *inside*
`if (user?.id)`, so when `getCurrentUser()` fails the query never runs and the page renders
"No jobs yet. Run a search above." — which the shipped spec explicitly forbids. `proxy.ts`
already redirects unauthenticated requests, so reaching that render *means* something broke.
Fixed here, in three lines, in a file being rewritten anyway; it also makes the
`load-failed` branch reachable for verification. No new requirement — the existing one
already covers it.

### D16. `select("*")` stays, and the reason gets a comment

Narrowing to the six rendered columns looks like an obvious win and has a landmine:
`parseJobRow` returns `null` unless `id`, `user_id`, `source` and `found_at` are all
present, so a select omitting `user_id` would parse **every** row to null and render an
empty table with no error anywhere. Beyond that, a narrowed select manufactures `Job`
objects whose unfetched columns read as `null` when the row has values — a trap for any
later consumer. Twenty rows of `*` is also a large improvement on today's unbounded
full-table select. Leave the comment so nobody "optimises" it later.

## Risks / Trade-offs

- **`count` depends on a response header surviving a proxy.** The single biggest risk, and
  the reason it is probed first with a named fallback (D6). Not discoverable by reading
  code.
- **`ilike` on `title`/`company` is a sequential scan** — no trigram index, and appending
  `id` means the ordering is not fully index-served either. At tens to low-hundreds of rows
  per user this is not measurable. If a user ever accumulates thousands, a `pg_trgm` index
  is the answer; adding one now would be a migration serving a load that does not exist.
- **`*` behaves differently from the shipped client filter** (D5). Accepted, specified,
  reversible via `imatch`.
- **The draft/debounce/resync protocol is the most invented part of the change** (D10). It
  is verified by hand — type, Back, Forward, and a fast burst — because nothing else can
  verify it here. Simpler fallbacks if it proves fragile: navigate on every keystroke (no
  timer, so the guard collapses to `!isPending`), or an uncontrolled input with an explicit
  submit, which drops live-as-you-type.
- **300 ms is a number, not a measurement.** No precedent in the repo.
- **`{ scroll: false }` on a page change** leaves a user who clicked Next at the bottom of
  the table looking at the bottom, with the new rows above. Scrolling the card into view
  needs a ref and `scrollIntoView`, a pattern this project does not have; predictable beats
  clever.
- **Cross-user isolation cannot be re-proven.** Only one `auth.users` row exists in dev and
  `jobs.user_id` has a foreign key to it, so a foreign row cannot be inserted.
  `.eq("user_id", userId)` is unchanged from shipped code and RLS select-own was verified in
  Feature 10. Stated as a gap, not claimed as coverage.
- **The dev `jobs` table is empty** (0 rows, 0 `agent_runs`), so every paging and ordering
  check runs against rows seeded by SQL. That is a feature, not a compromise: the edge cases
  that matter — identical `found_at` straddling a page boundary, unscored rows, a score of
  exactly 70, punctuation-hostile text — cannot be produced on demand by real searches, and
  ten billed searches would not reach three pages.

## Migration Plan

No database migration. No new dependency. No environment variable.

Order matters, because it keeps each step verifiable on its own:

1. Probe the backend unknowns (D6) with a temporary log, then remove it.
2. `lib/job-list-params.ts` and `types/index.ts`.
3. `page.tsx` — query, clamp, probe, range props, the D15 fix. The page is now
   server-driven with **dead controls**: hand-typed URLs must already drive all nine
   filter/sort combinations before any handler is written.
4. `JobsTable.tsx` — delete the four `useState`s and the four array helpers; render from
   props.
5. `JobsTable.tsx` — the handlers, refs, and resync block. Controls come alive.
6. `JobsPagination.tsx` — `disabled` and `pageWindow`; then the pending treatment.
7. Docs and specs.

Rollback is `git revert` of the commit: no persisted state changes shape, and a stale
bookmarked URL against the old code is simply ignored by a page that reads no
`searchParams`.

## Open Questions

- ~~**Does `content-range` survive the InsForge proxy?**~~ Yes — see D6 results.
- ~~**Do two `or=` parameters AND?**~~ No, they fail; one nested `or=` instead — see D6.
- **Is 300 ms right?** Unmeasured. Revisit if typing feels laggy or if the network panel
  shows a request per character.
- **Should the page scroll to the top of the list on a page change?** Deliberately not
  doing it (see Risks). If it annoys in use, it is a small addition.
- **Does a `pg_trgm` index become worth it?** Only once a single user's `jobs` count reaches
  the thousands. Nothing measures that today.
