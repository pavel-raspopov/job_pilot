## 1. Probe the backend before writing any UI

Design D6. Reading the library tells us what it *sends*; only the live backend tells us
what comes back. Nothing downstream is worth writing until these three answers are in.

- [x] 1.1 Seed the verification data from task 7.1 first — these probes need rows to count.
- [x] 1.2 In `app/(app)/find-jobs/page.tsx`, write `containsPattern()` (design D5, both
  escape layers in order) and a local `loadJobsPage()` with the full chain from design D2/D3
  (`select("*", { count: "exact" })`, `.eq("user_id", …)`, the band filter, the multi-key
  order ending in `id`, `.range()`), plus a temporary
  `console.log({ count, rows: jobs.length, sort, match, q })`. Verify `npm run lint` passes.
- [x] 1.3 **Does `count` arrive?** Load `/find-jobs` and read the dev-server terminal.
  Verify `count` is a number equal to the seeded row total, not `null`. **If it is `null`,
  stop and revise design D6** — `count` is parsed from the `content-range` *response
  header*, so a proxy that strips it forces a separate count query or an RPC, and every
  later task assumes a working count. Use `mcp__insforge__get-container-logs` to see what
  PostgREST actually received.
- [x] 1.4 **Do two `or=` parameters AND?** Load `/find-jobs?q=Percent&match=low`. Verify the
  logged `count` equals the SQL oracle for "matches the text **and** is in the low band",
  not the count for either condition alone. If it does not, switch to the disjunctive-normal-
  form single `.or()` named in design D6 and re-check.
- [x] 1.5 **Does the escaping hold?** For each of `Smith, Jones`, `50%`, `Under_score`,
  `Back\slash`, `He said "hello"`, `Asterisk (EU)`, `Colon:`, and a two-word phrase, load
  `/find-jobs?q=<urlencoded>` and verify the logged `count` equals the `position()` oracle
  from task 7.2 and that the page does not render "Could not load your jobs". Then load
  `?q=Star *` and **record in design D5 which behaviour you observed** (expected: `*` widens
  the match). If quoting fails, switch to `imatch` per design D5.
- [x] 1.6 Remove the temporary `console.log`. Verify `grep -n "console.log" app/\(app\)/find-jobs/page.tsx`
  returns nothing.

## 2. The URL contract

- [x] 2.1 Add `JobListParams` to `types/index.ts` beside `MatchFilter` and `JobSort`, with a
  one-line comment saying it is the list's view state and that it lives in the URL. Verify
  `npx tsc --noEmit` reports no errors.
- [x] 2.2 Create `lib/job-list-params.ts` exporting the defaults, `MAX_QUERY_LENGTH = 100`,
  `MAX_PAGE`, a zod schema with `.catch(default)` per field, and `parseJobListParams(raw)`
  (design D14: garbage falls back, `q` is truncated rather than rejected, a repeated
  parameter takes the first value). Include the docblock reason it is a module rather than
  two local functions — two consumers, one contract, `architecture.md`'s single-caller rule.
  Verify `npm run lint` passes.
- [x] 2.3 Add `jobListHref(params)` to the same module: emits **only** non-default values, so
  `/find-jobs` is the canonical zero state and `filtersActive` is decidable from the parsed
  params. Verify by hand that `{q:"",match:"all",sort:"score",page:1}` produces a bare path
  with no `?`.
- [x] 2.4 Verify the garbage matrix end to end once `page.tsx` reads the parser (after 3.2):
  `?page=abc`, `?page=0`, `?page=-1`, `?page=3.7`, `?page=1e9`, `?match=bogus`,
  `?sort=bogus`, a 101-character `q`, and `?q=a&q=b` each render the default view with no
  error and no stack trace in the terminal.

## 3. The server query

- [x] 3.1 Change `FindJobsPage` to accept `{ searchParams }: { searchParams: Promise<…> }`
  and `await` it (Next 16 — `searchParams` is a Promise). Verify `npm run build` passes.
- [x] 3.2 Wire `parseJobListParams`, `PAGE_SIZE = 20` as a module constant with a comment
  naming its single reader (design D2), and the `loadJobsPage()` from task 1.2. Verify
  `/find-jobs?sort=newest`, `?sort=oldest`, `?match=high`, `?match=low` and `?q=Acme` each
  change the rows — the controls are still dead at this point, so **hand-typed URLs must
  already drive all nine filter/sort combinations**.
- [x] 3.3 Add the clamp and conditional requery from design D8. Verify `?page=99` renders the
  last page with a range and total that describe it, and not an empty table; verify the
  requery does not run when the result set is empty.
- [x] 3.4 Set `loadFailed = true` on `authError || !userId` (design D15). Verify by hand that
  the branch is reachable — the existing code leaves it `false`, which renders "No jobs yet"
  for a broken session.
- [x] 3.5 Add `filtersActive`, `accountHasJobs()` and the `hasAnyJobs` expression from design
  D7, including the comment explaining why a probe failure returns `true`. Verify the probe
  query runs **only** when filters are active and the filtered total is zero (temporarily log
  it, check the two non-ambiguous branches make no second request, then remove the log).
- [x] 3.6 Compute `totalPages`, `rangeStart`, `rangeEnd` and pass them, `params`,
  `totalCount`, `hasAnyJobs` and `loadFailed` to `JobsTable`. Replace the docblock's "No
  `.limit()`" paragraph with the paging rationale, and add the `select("*")` comment from
  design D16. Verify `npx tsc --noEmit` reports no errors.

## 4. The list renders from props

- [x] 4.1 In `components/find-jobs/JobsTable.tsx`, delete `PAGE_SIZE`, `scoreOf`,
  `matchesQuery`, `matchesBand`, `selectJobs` and all four `useState` view values. Keep
  `MID_MATCH_THRESHOLD`, `scoreBandClass`, `MatchScoreCell`, `SourceBadge`, `EMPTY_COPY`,
  `EmptyState`, `TH_CLASS`, `TD_CLASS` and the entire table markup unchanged. Verify the
  `HIGH_MATCH_THRESHOLD` import is still present and still used by `scoreBandClass`.
- [x] 4.2 Replace the `Props` type with the new contract and render the table body from
  `jobs` directly (no derived list). Swap the `visible.length === 0` tests for
  `jobs.length === 0`, and gate the provider credit on `hasAnyJobs` rather than
  `jobs.length > 0`. Verify `npm run build` passes and the rows still render with hand-typed
  URLs.
- [x] 4.3 Change the empty-variant expression to
  `loadFailed ? "load-failed" : hasAnyJobs ? "no-matches" : "no-jobs"` and update the
  docblock above `EmptyVariant`, which currently explains the proof-by-array that no longer
  exists. Verify all three variants by hand (task 7.6).

## 5. The controls write the URL

- [x] 5.1 Add `usePathname`, `useTransition`, the `queryDraft` state, the `intended` ref, the
  `debounce` ref and `QUERY_DEBOUNCE_MS = 300` (design D10). Verify `npm run lint` passes.
- [x] 5.2 Add `hrefFor` (delegating to `jobListHref`), `go(overrides, mode)` wrapping every
  navigation in `startTransition` with `{ scroll: false }`, and `cancelPendingQuery`. Verify
  `npx tsc --noEmit` reports no errors.
- [x] 5.3 Rewrite the five handlers: `changeQuery` (local state + synchronous `intended`
  update + debounced `replace`), `changeMatchFilter`, `changeSort`, `changePage` (all
  `push`), and `clearFilters` (resets `q` and `match`, keeps `sort`, as today). Each except
  `changePage` resets `page` to 1. Verify every control now changes the URL and the rows.
- [x] 5.4 Add the resync block and the unmount cleanup (design D10). Verify by hand: type
  `engineer`, press Back — rows **and** the input text both return to the previous state;
  press Forward — both advance again. Then type a 10-character burst as fast as possible and
  confirm with `read_network_requests` that **exactly one** RSC request fired and the input
  never dropped a character.
- [x] 5.5 Verify `components/find-jobs/JobFilters.tsx` and `SearchControls.tsx` are still
  byte-identical: `git diff --stat components/find-jobs/` lists only `JobsTable.tsx` and
  `JobsPagination.tsx`.

## 6. Pagination and the pending affordance

- [x] 6.1 Add `disabled?: boolean` to `JobsPagination`'s props and thread it into all three
  `disabled` expressions (`disabled || page === 1`, `disabled || page === totalPages`,
  `disabled` on the numbers). Verify `npx tsc --noEmit` reports no errors.
- [x] 6.2 Add a local unexported `pageWindow(page, totalPages)` returning page numbers and
  elision markers — always the first page, the last page, and the pages adjacent to the
  current one (design D13). Rewrite the docblock: the old "never exceeds four pages"
  justification is false once the list is unbounded history. Verify at 3 pages (no ellipsis),
  and by hand-typing a URL against a seeded 200-row set that page 1 of 10 renders
  `1 2 3 … 10` and page 6 renders `1 … 5 6 7 … 10`.
- [x] 6.3 In `JobsTable`, add `aria-busy={isPending}` and the conditional `opacity-60` +
  `transition-opacity` on the table `<section>`, and pass `disabled={isPending}` to
  `JobsPagination` (design D12). Verify with a temporary 1.5 s sleep in `page.tsx`: the table
  dims and reports `aria-busy="true"`, the pagination buttons are genuinely `disabled`, the
  `<select>`s stay live, and the text input keeps focus, caret position and accepts typing
  throughout. Remove the sleep afterwards.
- [x] 6.4 Run `/imprint` to record the list-level pending pattern and the rewritten
  pagination entry in `context/ui-registry.md`. Verify both entries exist and that no raw
  Tailwind colour class or hex value was introduced (`opacity-60` is not a colour).

## 7. Verification

Seed once, then work the whole matrix. Sign in first — the Browser pane starts with no
session — reset viewport emulation before trusting a click, and prefer `javascript_tool`
against the DOM over screenshots.

- [x] 7.1 Seed 46 rows via `run-raw-sql`, all marked `source_url = 'seed:feature-11'` and
  scoped with `(select id from public.profiles order by created_at limit 1)` rather than a
  hardcoded uuid. Rows 1–25 share **one identical `found_at`** so the page-1/page-2 boundary
  falls inside a tie; include unscored rows, a score of exactly 0, 69 and 70; make every
  company+title pair unique (row `id` is not in the DOM, so the ordering oracle compares
  rendered pairs); include the punctuation-hostile rows from task 1.5 and one row with a null
  company. Verify `select count(*) from public.jobs` returns 46.
- [x] 7.2 Record the three SQL oracles: the band partition
  (`filter (where match_score >= 70)` + `filter (where match_score < 70 or match_score is
  null)` must equal `count(*)`), the expected ordering
  (`order by match_score desc nulls last, found_at desc, id desc`), and the literal-contains
  count using `position(lower(needle) in lower(coalesce(company,'')))`.
- [x] 7.3 **Paging integrity, per sort — the highest-value check.** For each of `score`,
  `newest`, `oldest`, walk pages 1→2→3 collecting every rendered company/role pair. Verify
  46 pairs, **46 unique**, and the sequence equal to the oracle's. This is the only check
  that catches the `found_at`-tie duplicate/skip failure; `score` matters most because the
  ties live there.
- [x] 7.4 Footer and controls: page 1 shows 20 rows and "Showing 1 to 20 of 46 results" with
  Previous genuinely `disabled`; page 3 shows "Showing 41 to 46 of 46" with Next `disabled`;
  `aria-current="page"` tracks the current page; `totalPages` equals `ceil(46/20)`.
- [x] 7.5 Bands and ordering: `match=high` shows only scores ≥ 70 and no unscored rows, with
  a footer total equal to the oracle's `high`; `match=low` total equals `low` and the em-dash
  rows are present; `high + low === all`; under `sort=score` the em-dash rows come last and
  the 0-score row sits immediately before them.
- [x] 7.6 Empty-state matrix, all four cells. Seeded + no params → list and credit. Seeded +
  `?q=zzzzz` → "no jobs match", Clear filters present, credit **still visible**. After the
  task 7.9 delete + no params → "no jobs yet", **no** Clear button, **no** credit. After the
  delete + `?q=zzzzz` → **"no jobs yet", not "no jobs match"** — the `accountHasJobs` branch
  and the easiest cell to get wrong.
- [x] 7.7 `load-failed`: temporarily point the query at a non-existent table and verify the
  alert icon, "Could not load your jobs", a Try again control, and **no** provider credit;
  revert. Separately exercise the auth-read failure from task 3.4, which is now a different
  branch.
- [x] 7.8 *(Run against `?q=engineer&match=low&sort=newest&page=2`: over the 46-row seed,
  `engineer` + High Match is 4 rows, so its page 2 would only exercise the clamp.)*
  `?q=engineer&match=high&sort=newest&page=2` survives a hard reload; then run **one
  real search** (billed; `agent_find` allows 10/hour) and verify all four parameters are
  intact afterwards, the new rows appear, and the banner still reports the run's counts
  rather than the table's. Also confirm with PostHog debug that a query-only URL change fires
  **no** `$pageview` and no new event name.
- [x] 7.9 `delete from public.jobs where source_url = 'seed:feature-11';` — verify the count
  returns to the real one (the rows from task 7.8's real search, and nothing else).
- [x] 7.10 Run `/verification-before-completion`: `npm run lint`, `npx tsc --noEmit`,
  `npm run build`, `npm run check:agents`, `npm run check:sync`, and
  `openspec validate --all --strict`. Paste the output; do not claim done without it.

## 8. Docs and specs

- [x] 8.1 `context/library-docs.md` — add the `count: "exact"` / `.range()` / `.or()` /
  `.ilike()` / `nullsFirst` patterns it documents nowhere, note that `count` comes from the
  `content-range` response header, and fix `insforge.from` → `insforge.database.from` in the
  DB Queries section. Verify by grepping for the old form.
- [x] 8.2 `context/architecture.md` — record `lib/job-list-params.ts` with its two-consumer
  justification, and update the `JobsTable.tsx` note so it describes URL-held state as done
  rather than planned.
- [x] 8.3 `context/ui-registry.md` — beyond task 6.4, fix the two stale entries found during
  design: the score bar carries `aria-hidden="true"`, not `role="img"` with an aria-label,
  and `SearchControls` takes no props.
- [x] 8.4 `context/build-plan.md` — note under Feature 11 that deduplication moved to its own
  change, with the reason (a pre-dedup `count` beside a post-dedup `range` makes the footer
  lie).
- [x] 8.5 `context/progress-tracker.md` — add the Feature 11 decision record, tick `11` in
  the Phase 3 list, and set `Last completed` / `Next` to `11` / `12`.
- [x] 8.6 Run `/feature-review` (adversarial) and fix everything Critical or Important before
  archiving. Then `/opsx-archive`, then `/remember save` — staging `memory.md` with the work,
  in one commit, with a one-line message.
