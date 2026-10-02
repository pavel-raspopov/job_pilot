# Memory — Feature 11 Filter + Sort + Pagination, then the matcher fix

Last updated: 2026-10-02 (matcher fix merged after Feature 11)

## What was built

Feature 11, the last item of Phase 3. `/find-jobs` filters, sorts and pages in
Postgres instead of slicing the whole list in the browser; the four view values
(`q`, `match`, `sort`, `page`) live in the URL; 20 rows per page.

OpenSpec change `add-server-side-job-list` — proposed (2026-09-04), applied,
reviewed, and archived to
`openspec/changes/archive/2026-10-02-add-server-side-job-list/`. Its delta
replaced four requirements in `openspec/specs/find-jobs/spec.md` (35 → 46
scenarios). The full decision record is in `context/progress-tracker.md` under
"Feature 11"; design corrections found during apply are recorded inline in the
archived `design.md` (D6, D8, D10, D12).

- **New:** `lib/job-list-params.ts` (parse / write the URL, `normalizeQuery`).
- **Modified:** `app/(app)/find-jobs/page.tsx` (the query, clamp, empty-state
  cause), `components/find-jobs/JobsTable.tsx` (renders props, writes the URL,
  pending state), `components/find-jobs/JobsPagination.tsx` (windowed pages,
  `disabled`, current-page class fix), `types/index.ts` (`JobListParams`).
- **Docs:** `ui-registry.md` (new **List pending state** entry and **Variant
  Class Standard**, five entries corrected), `architecture.md`,
  `library-docs.md` (DB Queries rewritten with the paging patterns),
  `build-plan.md`, `progress-tracker.md`.
- No migration, no dependency, no new PostHog event.

**Matcher fix**, a separate session, committed on top of Feature 11: some
searches had saved every listing unscored. `agent/matcher.ts` reads every tool
call, retries once, pins `minItems`, and logs drop counts; comments updated in
`lib/ai-rate-limit.ts` and `app/api/agent/find/route.ts`. No OpenSpec change —
a bug fix; the record is the tracker entry "Fix: searches saved every listing
unscored".

## Decisions made

All recorded in the tracker and the archived design. The ones that would hurt
to undo by accident:

- **Never call `.or()` twice in one InsForge query** — the second `or=` key is
  mangled by the InsForge records endpoint (PGRST100). Nest groups in one `.or()`.
- **The ordering must end in `id`.** Search batches share an identical
  `found_at`; without a unique last key, offset paging repeats and skips rows.
- **The out-of-range clamp has two branches and both are live.** An offset past
  the end is a 416 (PGRST103) with no count; an offset exactly at the end is a
  200 with the count. Neither is redundant.
- **JobsTable's `intended` view and "debounce armed" flag are state, not refs**
  — `react-hooks/refs` (react-hooks 7, via `eslint-config-next`) forbids reading
  refs in render, which the resync does.
- **Deduplication is its own change, next.** A pre-dedup count beside a
  post-dedup range would make the footer lie. Adzuna's `redirect_url` is a
  per-request tracking link — not a key; title + company at minimum.
- **Matcher: never go back to reading only `tool_calls[0]`, and keep
  `minItems` = job count on `matches`.** flash-lite intermittently sent an empty
  `{"matches":[]}`, alone or ahead of a second call. The gateway enforces
  `minItems` (probed). No `maxItems` — a capped array spills into extra parallel
  calls instead of stopping.
- **The scoring retry does not consume a search slot** (the flakiness is the
  model's): worst case 20 billed calls an hour, noted in `LIMITS`. The developer
  has not ruled on this — revisit if they want retries counted.

## Problems solved

- **The power cut lost the session before `/remember save`.** State was rebuilt
  from `git status`, file mtimes and the change's `tasks.md`. The 46 seed rows
  from the interrupted session were still in the DB.
- **InsForge backend was paused** after three weeks idle: health check 503 "No
  backend services available". Not the MCP config this time — the `${VAR}`s
  expanded fine. The developer resumed it in the console; then a full app
  restart reconnected the MCP.
- **`aria-busy` does not announce** — it suppresses. A `role="status"` region
  outside the busy section speaks "Updating results…".
- **A navbar click within 300 ms of typing was swallowed** by the debounce's
  late `router.replace` (Next abandons a pending navigation for a newer one).
  Fixed by sending waiting text on blur; Back/Forward cancels it.
- **The current page button was never highlighted** (since Feature 09): an
  appended `bg-accent-muted` loses to `bg-surface` on stylesheet order.
- **"scored 0 of 10" was an empty tool call, not dropped entries.** The
  string-typed-index theory was refuted by response size alone: the InsForge
  request log showed the failing `/chat/completion` at 284 bytes against 5,851
  for a good one. 3 of 19 first replies on that payload opened empty before the
  fix; 10 of 10 scored first time after it, and the live check scored 10/10.

## Current state

- `npm run lint`, `npx tsc --noEmit`, `npm run build`, `check:agents`,
  `check:sync`, `openspec validate --all --strict` (3 specs) all pass.
- Verified live against SQL oracles: 66 filter/band combinations, paging
  integrity per sort (sha256 of rendered order = SQL order), out-of-range
  cases, the four empty-state cells with a genuinely empty account, Back/Forward,
  typing bursts, pending state, hard reload, one real billed search.
- Adversarial review: 0 Critical, 2 Important, 9 Minor — both Important and
  seven Minors fixed and re-verified live; one Minor accepted (Next clicked
  within 300 ms of typing lands on page 2 of the new filter).
- Committed with this memory file; nothing deployed.
- Dev DB: 20 real jobs from 2 searches, all scored, no seed rows. The pre-fix
  failure's 10 unscored jobs and their run were deleted on 2026-10-02; its
  `ai_usage` row was kept, since that call was really billed.
- **Matcher fix is merged** on top of Feature 11. Lint, tsc and build pass on
  the rebased code; a 13-case offline harness (empty, partial, throwing, slow and
  malformed replies) never throws, never exceeds two calls, and logs no reason
  text.

## Next session starts with

`/opsx-propose` **job deduplication** — a write-path change to
`POST /api/agent/find`, composite key (title + company at minimum, not the
apply URL). Read `build-plan.md` Feature 11's dedup note and the Feature 10
tracker entry on `redirect_url` first. Then Feature 12 Job Details Page.

## Open questions

- **`missing_skills` can contradict the profile** — one scoring reply listed
  React and TypeScript as missing for a candidate who has both. Never
  benchmarked; settle it before Feature 12 renders the skill lists.

- Next fetches bare `/find-jobs` twice per navigation (dev and prod; a direct
  `router.push` reproduces it). Harmless, cause unknown.
- The status region is verified in the DOM, not with NVDA/VoiceOver.
- 300 ms debounce is unmeasured. A `pg_trgm` index only if a user reaches
  thousands of jobs. `?page=1e20` (unsafe integer) falls back to page 1.
- Carried over from Feature 10: `location_searched` records "Remote" as typed;
  empty `match_reason` stored as `''`; four Adzuna markets only; Feature 13 has
  no model path for Stagehand (do not reintroduce `OPENAI_API_KEY`);
  `agent_logs` has no writer; `ai_usage` retention unhandled; Feature 06
  leftovers (save-success copy, resume input reset, tag input clear);
  `maxDuration = 120` vs the hosting plan unverified.

## Testing notes

- **Sign in first** — the Browser pane session expires (it did over 8 days).
  Signing in is the developer's; never automate it.
- **The pane runs "hidden"**: `setTimeout` throttles to ~1 s and CSS
  transitions stall. Space scripted keystrokes with a `MessageChannel` wait and
  measure one known delay before trusting any timing result.
- **SQL oracle technique**: compute the expected ordering in SQL, hash it
  (`encode(sha256(convert_to(string_agg(…), 'UTF8')), 'hex')`), hash the
  rendered company|title pairs in the page with `crypto.subtle`, compare.
  `position(lower(needle) in lower(col))` is a wildcard-free contains oracle.
- **Seed rows** use `source_url = 'seed:…'` so one `delete` cleans them.
  `CREATE SCHEMA` is denied on InsForge; a temporary backup table in `public`
  needs `enable row level security` (no policies) and a `drop` afterwards.
- **To test a timing race, reproduce it live** — the static review graded the
  navbar race Minor; 3/3 live reproduction made it Important.
- **Benchmark scoring without spending searches:** call the gateway directly with
  the SDK's `createClient` (anon key from `.env.local`, `retryCount: 0`) and the
  matcher's own prompt and tool builders. That bypasses the route, so it uses no
  Adzuna quota and no `ai_usage` slot. Usage arrives camelCase
  (`completionTokens`). `get-container-logs insforge.logs` records each
  `/chat/completion`'s response size and duration.
- **The scratchpad is wiped between sessions** — a harness written there will be
  gone. A grep for failure counts over a script that never ran reads as a clean
  pass; check that the expected number of cases actually ran.
- Carried over: reset viewport emulation before trusting a click; dispatch
  synchronous clicks to test in-flight guards; test the rate limit by inserting
  `ai_usage` rows; never print `.env.local` values; `assets/CV …pdf` is the
  uncommitted extraction fixture; never click Save Profile while testing.
