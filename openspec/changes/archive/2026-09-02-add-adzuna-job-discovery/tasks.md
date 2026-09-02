## 1. Credentials and configuration

- [x] 1.1 Add `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` to `.env.local` (no `NEXT_PUBLIC_`
  prefix — they are secrets, obtained from `developer.adzuna.com`). **Human gate.** Verify
  with `grep -c '^ADZUNA_APP_' .env.local` returning `2` — never print the values.
- [x] 1.2 Confirm the credentials work with one hand-run request to
  `https://api.adzuna.com/v1/api/jobs/us/search/1` (`what=frontend+engineer`,
  `category=it-jobs`, `results_per_page=10`). Verify the response is HTTP 200 with a
  non-empty `results` array, so a later 403 is unambiguously a code bug. Do not echo the
  full URL into the transcript.
- [x] 1.3 Add `serverEnvSchema` and the cached `serverEnv()` accessor to `lib/env.ts` per
  design D1, with a comment naming why it is separate from `envSchema` (the browser-bundle
  and Edge-proxy import chain). Verify `npm run build` passes — this is the step that would
  otherwise break the client bundle.
- [x] 1.4 Add `agentFind: "agent_find"` to `AI_ROUTE` and
  `agent_find: { windowSeconds: 3600, max: 10 }` to `LIMITS` in `lib/ai-rate-limit.ts`,
  with a comment noting the limit counts searches rather than listings and also caps the
  shared provider quota. Verify `npm run lint` passes and no migration is needed
  (`ai_usage.route` is free text).
- [x] 1.5 Add `FindActionResult` to `types/index.ts` beside `ExtractActionResult` /
  `GenerateActionResult`, documenting that both counts describe the run and not the table.
  Verify `npx tsc --noEmit` (or `npm run build`) reports no type errors.

## 2. Provider client — `agent/adzuna.ts`

- [x] 2.1 Create `agent/adzuna.ts` with the `AdzunaCountry`, `AdzunaJob` and
  `AdzunaSearchResult` types and module constants (base URL, `RESULTS_PER_PAGE = 10`, a 10s
  request timeout, minimum annual salary). Verify `npm run lint` passes.
- [x] 2.2 Implement and export `detectCountry(location)` per design D7 — country names and
  unambiguous abbreviations only, comma segments scanned right to left, default `us`.
  Verify by hand against `"San Francisco, CA"` → `us`, `"London, UK"` → `gb`,
  `"Toronto, Canada"` → `ca`, `"Austin, Texas, USA"` → `us`, `"Sydney, Australia"` → `au`,
  `""` → `us`.
- [x] 2.3 Implement `formatSalary(min, max, country)` — currency symbol per country, drop
  figures below the annual minimum, no "(estimated)" suffix. Verify by hand that a
  min-only listing returns a single figure rather than throwing (the bug in
  `library-docs.md`'s snippet) and that a missing salary returns `null`.
- [x] 2.4 Implement `searchJobs(jobTitle, location)`: build the query with
  `category: "it-jobs"` always set and the location parameter omitted when empty or a
  working arrangement; fetch with an abort timeout and `cache: "no-store"`; validate the
  body with a tolerant per-field zod schema; drop listings missing a title or apply URL;
  de-duplicate on apply URL. Verify the function never throws by exercising it against a
  bad country path and confirming it returns `{success:false}`.
- [x] 2.5 Confirm no log line or error string in this module contains the app key or the
  full request URL — only country, status and result count. Verify by
  `grep -n "APP_KEY\|params}" agent/adzuna.ts` showing no occurrence inside a log call.

## 3. Scoring — `agent/matcher.ts`

- [x] 3.1 Create `agent/matcher.ts` with the `ScoredMatch` type, the `MATCHING_MODEL`
  constant carrying a placeholder benchmark comment, and the output/skill/description caps.
  Verify `npm run lint` passes.
- [x] 3.2 Build the model input from the profile, including only scoring-relevant fields
  and **excluding** name, email, phone and personal links per the spec's identity-withheld
  requirement. Verify by reading the constructed payload in a `console.log` during one dev
  run that no identity field appears, then remove the log.
- [x] 3.3 Define the `record_matches` tool schema with a required `job_index` on every
  entry per design D2, and the prompt rules (one entry per job, integer 0–100, 2–3 sentence
  reason, matched skills drawn from the profile only, no invented requirements). Verify
  `npm run lint` passes.
- [x] 3.4 Implement `scoreJobs(profile, jobs)` returning an array index-aligned with
  `jobs`: parse the tool-call arguments, validate with a fully-optional zod schema, map
  entries by `job_index` (first wins, out-of-range dropped), and **clamp and round every
  score into 0–100** per design D3. Verify by hand that a simulated response with a `105`,
  a duplicate index and a missing entry yields in-range scores, no misattribution, and
  `null` for the missing job.
- [x] 3.5 Confirm every failure path (gateway throw, no tool call, unparseable JSON, schema
  reject, absent `matches`) returns all-nulls after a `[agent/matcher]` log rather than
  throwing. Verify by temporarily pointing `MATCHING_MODEL` at a nonexistent model id and
  observing the route still saves jobs with null scores.
- [x] 3.6 **Benchmark the model** on one real profile and one real ten-listing provider
  response: `google/gemini-2.5-flash` against `gemini-2.5-flash-lite`. Record token counts,
  cost and the three judgements from design D12 in the comment above `MATCHING_MODEL`,
  replacing the placeholder. Verify the comment contains real numbers, not placeholders.

## 4. Route — `app/api/agent/find/route.ts`

- [x] 4.1 Create the route with `export const maxDuration = 120`, the local `fail()`
  helper returning HTTP 200, the hoisted user-facing message constants (auth, invalid
  input, no profile, thin profile, provider unavailable, service, rate limit) and the body
  zod schema (`jobTitle` required and length-bounded, `location` optional). Verify
  `npm run lint` passes.
- [x] 4.2 Implement the free-failure prefix in order: parse body → validate → authenticate
  → load profile → gate on "skills or current title" per design D14. Verify each path with
  a `curl` returning `{success:false}` and the expected message, and confirm the browser
  Network tab shows no provider or gateway traffic for any of them.
- [x] 4.3 Add the rate-limit check before the provider call and `recordAiCall` after a
  successful provider response per design D4, each with the comment explaining the split.
  Verify an 11th search within an hour is refused with the retry phrase and that a forced
  provider failure does not consume a slot (check `ai_usage` row count via the InsForge
  MCP).
- [x] 4.4 Implement the `agent_runs` lifecycle: insert `running` with the searched title
  and location, hold the run id **outside** the try, and add the `finishRun()` helper that
  writes a terminal status, count and completion time and never throws. Verify via
  `run-raw-sql` that no run row is left `running` after success, provider failure, and an
  induced unexpected throw.
- [x] 4.5 Wire the happy path: `searchJobs()` → zero-result short-circuit returning success
  with zeros and a `completed` run → `recordAiCall` → `scoreJobs()` → map rows
  (`source: 'search'`, `about_role` from the snippet, the five Feature 12 columns null,
  `found_at` omitted per design D11) → single `insert([...])` → `finishRun('completed')`.
  Verify with `run-raw-sql` that ten `jobs` rows exist with scores in 0–100 and those five
  columns NULL.
- [x] 4.6 Add the analytics block: `job_search_started` after the rate-limit check and run
  insert, one `job_found` per saved job, then `await flush()`, all wrapped so analytics
  failure cannot fail a saved search. Verify the events arrive in PostHog and that a
  refused search produces **no** `job_search_started`.
- [x] 4.7 Add `revalidatePath("/find-jobs")` on success and the outer catch that marks a
  held run failed and returns the service error. Verify `npm run build` passes.

## 5. Reading jobs — page and parser

- [x] 5.1 Create `lib/parse-job.ts` exporting `parseJobRow(value: unknown): Job | null`,
  mirroring `lib/parse-profile.ts`: reject rows without a string `id`, `user_id`,
  `found_at` or a `source` outside `'search' | 'url'`; never coerce a missing
  `match_score` to zero. Verify `npx tsc --noEmit` passes with no `any` assignment and no
  `as Job` assertion.
- [x] 5.2 Convert `app/(app)/find-jobs/page.tsx` to an async server component that
  authenticates, selects the signed-in user's `jobs` scoped by `user_id` and ordered
  `found_at` descending with no `.limit()`, and maps rows through `parseJobRow`. Verify the
  page renders real rows after a search and only that user's rows
  (confirm the count against `run-raw-sql`).
- [x] 5.3 Set a `loadFailed` flag when the select errors, log it with the
  `[find-jobs/page]` prefix, and pass it to `JobsTable`. Verify by temporarily selecting a
  nonexistent column that the page renders the load-failure empty state rather than an
  empty account.
- [x] 5.4 Delete `MOCK_SEED`, `MockSeed`, `MOCK_USER_ID`, `buildMockJobs()`, the
  `strongMatches` derivation, the now-unused imports, **and the stale header comment**
  claiming nothing below the file changes. Verify `npm run lint` reports no unused symbols
  and `grep -c "buildMockJobs" app/\(app\)/find-jobs/page.tsx` returns `0`.

## 6. Search UI — `components/find-jobs/SearchControls.tsx`

- [x] 6.1 Rewrite the component's contract: props become `{ userId }`, the `searched`
  boolean becomes an `idle | searching | success | error` union, and the
  `jobsFound`/`strongMatches` props are removed per design D8. Verify `npm run build`
  passes (it will fail until `page.tsx` from task 5.2 passes `userId`).
- [x] 6.2 Add the synchronous `searchingRef` in-flight guard — set after validation,
  released in `finally` — with the comment naming the measured double-billing it prevents.
  Verify by double-clicking Find Jobs that the Network tab shows **exactly one**
  `POST /api/agent/find`. This is the single most important check in the change.
- [x] 6.3 Implement the submit handler: build `FormData` from `event.currentTarget`
  **synchronously before any await**, trim both fields, refuse an empty job title with
  focus returned to that field and no request issued, then POST and read
  `result.success` (never `response.ok`). Verify the empty-title path issues zero network
  requests and moves focus.
- [x] 6.4 Do NOT fire `job_search_started` from the client. **Corrected during
  verification:** firing it here as well as in the route double-counted every search
  (7 events for 4 searches, confirmed in PostHog) and counted a rate-limited search
  that never started — both contrary to the spec's "counted once" and "a refused
  search is not counted" scenarios. Only the server knows whether a search survived
  the rate-limit check, so `POST /api/agent/find` owns the event; leave a comment at
  the call site saying so. Verify exactly one `job_search_started` per search that
  runs, and none for a refused one.
- [x] 6.5 Render the states with existing tokens only — no new tokens, no hardcoded hex, no
  raw Tailwind color classes: a disabled button labelled "Searching…", an always-mounted
  `role="status"` wrapper carrying the searching / no-results / success messages, and a
  separate `role="alert"` error line. Server-supplied errors render verbatim; a
  zero-result search uses the neutral banner, not the success one. Verify by
  `grep -nE "#[0-9a-fA-F]{6}|bg-(blue|gray|green|red)-" components/find-jobs/SearchControls.tsx`
  returning nothing.
- [x] 6.6 Call `router.refresh()` on the success path only. Verify that after a search the
  new rows appear **and** an already-set sort, filter and page position are preserved.

## 7. Empty states — `components/find-jobs/JobsTable.tsx`

- [x] 7.1 Add the `loadFailed` prop and derive a three-way empty variant
  (`load-failed` → `no-jobs` → `no-matches`) per the spec. Verify `npm run build` passes.
- [x] 7.2 Add the local non-exported `EmptyState` component (matching the file's existing
  `MatchScoreCell` / `SourceBadge` pattern — **no fifth file** in
  `components/find-jobs/`) rendering the three copies: "No jobs yet. Run a search above to
  find jobs matched to your profile." with no button and a `Search` icon; the unchanged
  "No jobs match the current filters." with Clear filters; and "Could not load your jobs.
  This is usually temporary." with a Try again control. Verify all three by hand
  (zero rows, an over-narrow filter, and an induced select error).
- [x] 7.3 Delete `hasActiveFilters` and its conditional around Clear filters — reaching the
  `no-matches` branch proves a filter is active. Verify `npm run lint` reports no unused
  variable and Clear filters still appears in that state.
- [x] 7.4 Remove the `FEATURE 10` deferral comment now that the case is handled. Verify
  `grep -c "FEATURE 10" components/find-jobs/JobsTable.tsx` returns `0`.

## 8. Documentation

- [x] 8.1 Run `/imprint` and update `context/ui-registry.md`: rewrite the SearchControls
  entry to record the counts-from-response reversal (design D8) rather than leave it
  contradicting the old props rationale, move `role="status"` to the wrapper, note the
  "Searching…" label swap, and document the three empty-state variants. Verify the entry
  no longer claims counts are passed as props.
- [x] 8.2 Update `context/architecture.md`: add the `agent/` modules and
  `lib/parse-job.ts`, and delete the stale `lib/adzuna.ts` line that contradicts
  `agent/adzuna.ts`. Verify `grep -n "lib/adzuna" context/architecture.md` returns nothing.
- [x] 8.3 Update `context/code-standards.md`: fill in the Adzuna env-var rows with their
  usage site and the server-only accessor note, and correct the route template's HTTP-500
  error shape to the shipped HTTP-200 `{success:false,error}` pattern. Verify both edits
  are present.
- [x] 8.4 Update `context/progress-tracker.md` with the Feature 10 record, including the
  four resolved doc conflicts and the two deliberate deferrals (`agent_logs` and
  `agent/types.ts`) recorded as decisions rather than omissions.

## 9. Verification

- [x] 9.1 Run `npm run lint` and `npm run build` and show the output. Both must pass with
  no new warnings.
- [x] 9.2 Run `npm run check:agents` and `npm run check:sync`, and
  `openspec validate add-adzuna-job-discovery --strict`. Show the output.
- [x] 9.3 Manual click-through in the Browser pane — **sign in first, the pane holds no
  session**, and reset viewport emulation before trusting any click. Cover: first-ever
  visit empty state; empty-title refusal with zero requests; the double-click single-request
  check; a real search showing "Searching…" then the run's counts and new rows with filter
  state preserved; a zero-result search on a nonsense title; the rate-limit message on the
  11th search; a mid-flight network kill leaving the button usable on retry.
- [x] 9.4 Assert the data through the InsForge MCP `run-raw-sql`: the `agent_runs` row is
  `completed` with a `jobs_found` matching the rows written and no row left `running`; the
  `jobs` rows carry `source='search'`, scores within 0–100, and NULL in
  `responsibilities`, `requirements`, `nice_to_have`, `benefits`, `about_company`.
- [x] 9.5 Confirm both PostHog events arrived with their specified payloads, and that a
  refused search produced no `job_search_started`.
- [x] 9.6 Run `/verification-before-completion` and show the command output, then
  `/feature-review`. Address findings before archiving.
- [x] 9.7 Run `/remember save` and stage `memory.md` with the work before committing —
  never leave memory for a follow-up commit.

## 10. Review fixes (from /feature-review, before archive)

- [x] 10.1 Move `recordAiCall` ahead of the zero-result short-circuit in
  `app/api/agent/find/route.ts`. The review found the code contradicted design D4: a
  zero-result search consumed no allowance unit, so a loop of such queries could drain
  the shared Adzuna quota while the limiter sat at zero — defeating the reason the check
  runs before the provider. Verified: `ai_usage` went 6 -> 7 across one zero-result
  search, where it previously stayed at 6. A provider outage still consumes nothing.
- [x] 10.2 Add the "Jobs by Adzuna" credit to `components/find-jobs/JobsTable.tsx`,
  required by `context/project-overview.md` and by the provider's API terms, and absent
  from both the implementation and the original proposal. Rendered whenever the user has
  saved jobs, not gated on the active filter. Verified visible in the browser.
- [x] 10.3 Rewrite `NO_RESULTS_MESSAGE` to name the searchable countries. An
  unrecognised country silently falls back to a United States search, so "Berlin,
  Germany" returns nothing and the old copy ("try a broader location") pointed at a path
  that could never work. Verified in the browser.
- [x] 10.4 Record, deliberately WITHOUT fixing, the cross-search duplicate finding (Feature 11 owns dedup). Recorded
  for that feature: Adzuna's `redirect_url` is a per-request tracking link, so the same
  listing saved by two searches has two different `external_apply_url` values. Measured:
  grouping by URL found 0 duplicates while grouping by title+company found 8 at 3 copies
  each. Dedup must use a composite key, not the apply URL.
