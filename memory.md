# Memory — Feature 10 Adzuna Job Discovery

Last updated: 2026-09-02

## What was built

Feature 10, the second item of Phase 3. `/find-jobs` no longer renders a mock
array — it reads the signed-in user's saved jobs, and the Find Jobs button runs a
real, billed search.

OpenSpec change `add-adzuna-job-discovery` — proposed, applied, reviewed, and
archived to `openspec/changes/archive/2026-09-02-add-adzuna-job-discovery/`. It
created a new `openspec/specs/job-discovery/spec.md` (12 requirements, 38
scenarios) and rewrote three requirements in `openspec/specs/find-jobs/spec.md`.

- **New:** `agent/adzuna.ts` (search, country inference, salary formatting,
  response normalisation), `agent/matcher.ts` (one batched scoring call),
  `app/api/agent/find/route.ts`, `lib/parse-job.ts`.
- **Modified:** `lib/env.ts` (lazy `serverEnv()`), `lib/ai-rate-limit.ts`
  (`agent_find`, 10/hr), `types/index.ts` (`FindActionResult`),
  `app/(app)/find-jobs/page.tsx` (async, DB-backed), `SearchControls.tsx`
  (rewritten), `JobsTable.tsx` (three-way empty state + attribution).
- No migration. `agent_runs`, `jobs` and `ai_usage.route` already covered it.

The full decision record is in `context/progress-tracker.md` under "Feature 10
Adzuna Job Discovery".

## Decisions made

- **Adzuna credentials use a separate `serverEnv()` accessor, not `envSchema`.**
  `lib/env.ts` is imported by `lib/insforge-client.ts` (browser) and `proxy.ts`
  (Edge), and `loadEnv()` runs at module load. A server-only key in that schema
  is `undefined` in the browser and throws during bundle evaluation.
  `insforge-client.ts` has no importers today, so it would have shipped green and
  broken later, far from the cause. **Do not merge the two schemas.**
- **One batched gateway call per search, with an explicit `job_index`** on every
  scored entry. Positional trust is unsafe: a model returning 7 of 10 would shift
  every later score onto the wrong employer, and all ten rows would still render
  plausibly. Same call Feature 08 made with `role_index`.
- **Scores are clamped and rounded before the insert.** `match_score` has
  `CHECK (0..100)` and all ten rows go in one atomic `insert([...])`, so a single
  `105` would reject the whole batch.
- **The model benchmark reversed the assumption: `gemini-2.5-flash-lite` ships.**
  Measured on the same payload — both 10/10 with correct indices, both inventing
  zero skills, flash-lite slightly better spread and ~3.6x cheaper (~$0.0007 vs
  ~$0.0025 a search). A model chosen for one task is not automatically right for
  the next.
- **Banner counts come from the response, not props** — reversing Feature 09.
  Once the table holds history, `jobs.length` would say "Found 20 jobs" after a
  search that found 10. Proven live: 20 rows on screen, banner said 10.
- **The five structured columns stay NULL** (`responsibilities`, `requirements`,
  `nice_to_have`, `benefits`, `about_company`). Adzuna returns a ~500-char
  snippet, which goes in `about_role`. Feature 12 fills the rest honestly.
- **`found_at` is left to the database default**, not stamped by the caller — the
  list renders it as "2 hours ago".
- **Country inference matches country names only**, never cities or state codes.
  "San Francisco, CA" is California, "Indianapolis, IN" is Indiana.

## Decisions made (cont.)

- **Commit messages are one line from now on** — `type(scope): summary` under 72
  chars plus the `Co-Authored-By` trailer, no body. Recorded in `AGENTS.md` under
  "Rules that never change". This restores the repo's own earlier convention:
  `f0fb6f7`, `f59d015`, `c9b8f26` and `0b64554` are all two lines, and the
  multi-paragraph bodies on `9bae6bf` and `a216397` were drift I introduced, not
  house style. The detail belongs in `progress-tracker.md` and the OpenSpec
  artifacts, which stay current — a commit body is frozen and goes stale.

- **New rule: check the repo's existing convention before writing any artifact type
  for the first time in a session** (`AGENTS.md`, "Rules that never change").
  Concrete checks, not intentions: `git log -8 --format=%B` before a commit, read a
  sibling before a component, read an existing route before a new one. The mechanism
  it guards against: during a long autonomous run the strongest pull on style is my
  own recent prose, not the project's conventions. Diagnostic from this session —
  the token rule is *stated* and had 100% compliance; commit style was only
  *demonstrated* by four two-line commits and drifted on the first try.

## Problems solved

- **`job_search_started` fired twice per search.** Both the client and the route
  emitted it — 7 events for 4 searches, and a rate-limited search that never ran
  was still counted. The planning artifacts had assigned the event to both
  halves; that was the real defect. **The route owns it**, because only the
  server knows whether a search survived the rate-limit check. `SearchControls`
  lost its `userId` prop as a result.
- **A zero-result search consumed no rate-limit slot**, contradicting the design.
  `recordAiCall` sat after the zero-result branch, so a loop of nonsense queries
  could drain the shared Adzuna quota while the limiter read zero — defeating the
  reason the check runs before the provider. Fixed by recording the slot as soon
  as the provider answers. Verified 6 -> 7; a provider outage still costs nothing.
- **An unrecognised country silently falls back to a US search.** "Berlin,
  Germany" returns nothing while the copy said "try a broader location" — advice
  that could never work. The empty-state copy now names the four searchable
  markets (US, UK, Canada, Australia).
- **"Jobs by Adzuna" attribution was missing** from the implementation *and* the
  proposal, though `project-overview.md` requires it and it is a condition of the
  API terms. Now rendered by `JobsTable` whenever the user has saved jobs, not
  gated on the active filter.
- **`library-docs.md`'s Adzuna snippet has a real bug**: it reads `salary_max!`
  while guarding only on `salary_min`, so a one-figure listing throws.
  `formatSalary()` handles min-only, max-only and equal values.
- **The InsForge MCP works now.** Root cause was `${VAR}` in `.mcp.json` reading
  Claude Code's own process environment, not `settings.local.json`. Fixed by
  Windows user-scope env vars; takes effect only after a **full app restart**
  (close window, exit tray icon, end task) — there is no `claude` on PATH here,
  so "open a new terminal" is not the fix.

## Current state

- `npm run lint`, `npm run build`, `npx tsc --noEmit`, `check:agents`,
  `check:sync` and `openspec validate --all --strict` (3 specs) all pass.
- **Verified live against the signed-in app**, not just reasoned about: three
  synchronous clicks produced exactly one POST, one run row and one usage row;
  a hostile model response (105, duplicate index, missing entry) clamped and
  placed correctly; a gateway throw returned ten nulls with jobs still saved;
  missing credentials produced a service message, a `failed` run, no slot
  consumed and no key in any log; the rate limit refused before the run insert;
  all five free-failure paths made zero provider/gateway calls; a load failure
  showed distinct copy rather than "run your first search"; `London, UK` routed
  to the `gb` market with `£` salaries.
- **Adversarial `/feature-review`: 3 Important, 1 Minor, 0 Critical.** All three
  Important fixed and re-verified before archive. The Minor (duplicates) is
  deliberately deferred to Feature 11.
- Not committed yet at the time of writing; nothing deployed.
- Dev DB holds ~70 test job rows and ~10 runs from verification, including
  duplicates. Harmless, but not clean seed data.

## Next session starts with

`/opsx-propose` **Feature 11 Filter + Sort + Pagination** — move filtering,
sorting and pagination server-side, raise `PAGE_SIZE` from 6 to 20, and add
deduplication.

**Read this before designing dedup:** Adzuna's `redirect_url` is a *per-request
tracking link*, so the same listing saved by two searches has two different
`external_apply_url` values. Measured: grouping by URL found 0 duplicates while
grouping by title+company found 8 listings at 3 copies each. **The apply URL
looks like the natural key and is not one** — dedup needs a composite key
(title + company at minimum).

`JobsTable.tsx` was built for this: the filter rules are plain functions over an
array, so what changes is where the array comes from, not the component split.

## Open questions

- **Two-payload benchmark is a thin sample** for flash-lite's index reliability.
  The failure it guards against is a short reply leaving jobs unscored, which
  shows as an em dash rather than a wrong number. Watch for those; re-measure if
  the prompt or profile shape changes.
- `location_searched` records "Remote" even though that search runs nationwide —
  intent, not what executed. Matters when Feature 16 renders the activity feed.
- An empty `match_reason` is stored as `''` and read back as `null`. Harmless
  now; Feature 12 should confirm it renders as absent rather than blank.
- Only four Adzuna markets are supported (us/gb/ca/au). Adding more is a one-line
  map change in `agent/adzuna.ts`.
- Feature 13 still has no answer for how Stagehand reaches a model. Do not
  reintroduce `OPENAI_API_KEY`.
- `agent_logs` still has no writer, and `agent/types.ts` was deliberately not
  created — both recorded as decisions in `context/architecture.md`.
- `ai_usage` retention is unhandled; cleanup statement is in migration `004`.
- Feature 06 leftovers still open: save-success copy, resume file input not
  resetting, skills/industries tag input not clearing after "Add".
- `maxDuration = 120` vs the hosting plan's ceiling — unverified, nothing deployed.

## Testing notes

- **Verifying a protected route needs the developer to sign in** in the Browser
  pane first — the pane starts with no session.
- **Reset viewport emulation before trusting a click** (`resize_window` preset
  `desktop`); a small pane with emulation misdelivers coordinates.
- Prefer `javascript_tool` + the DOM over screenshots for UI facts in this pane.
- **To test the in-flight guard properly, dispatch clicks synchronously**
  (`b.click(); b.click(); b.click()` in one tick). A `double_click` lets React
  re-render between clicks and proves nothing — the whole point is that
  `disabled` is still `false` at that moment.
- **To test the rate limit without spending money**, insert rows straight into
  `ai_usage` via `run-raw-sql`, then search; the refusal happens before the
  provider call. Clean the synthetic rows up afterwards.
- **To test a provider outage**, back up `.env.local`, invalidate
  `ADZUNA_APP_KEY`, restart the dev server, search, then restore. Never print the
  real values.
- Pure agent modules can be exercised outside Next with a throwaway tsconfig
  (`module: CommonJS`, `paths` for `@/*`, `outDir` inside the project). `tsc`
  does **not** rewrite path aliases at emit — `sed` the `@/` requires in the
  compiled output, and stub `lib/insforge-ai.js` because the InsForge SDK will
  not load under CommonJS.
- `assets/CV Pavel Raspopau ….pdf` is the extraction fixture; **not committed**.
- **Never click Save Profile while testing extraction** — reload instead.
