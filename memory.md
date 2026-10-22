# Memory — Skill lists held to the profile

Last updated: 2026-10-22

## What was built

The model's skill lists can no longer claim skills the user lacks. OpenSpec change
`filter-match-skills`: proposed, applied, reviewed and archived to
`openspec/changes/archive/2026-10-22-filter-match-skills/` on 2026-10-22. Its delta
modified the `job-discovery` requirement "Discovered jobs are scored against the user
profile" with one paragraph and three scenarios. The decision record is in
`context/progress-tracker.md` under "Skill lists held to the profile".

- **Modified:** `agent/matcher.ts` only. Added `skillKey()` and the exported pure
  `restrictToProfileSkills(match, profileSkills)`. `scoreJobs` applies it once to the
  merged results before its final log, and logs
  `removed skills not in the profile { listings, matched, missing }` (counts only) when
  anything was removed. The model-choice comment's "invented zero skills" is corrected.
- **Unchanged on purpose:** the prompt, the tool schema (`maxItems: 6` stays),
  `mapScoredMatches`, the route and the UI.
- **Dev DB:** 11 rows' `matched_skills` / `missing_skills` corrected by one SQL `UPDATE`
  applying the same rule. Not a migration, since nothing is deployed.
- **Docs:** `library-docs.md` (Saving Jobs to DB: the filter, and never write the model's
  lists without `scoreJobs`) and `progress-tracker.md` (a new entry, plus the old
  "Open, not fixed here" note re-diagnosed).

## Decisions made

- **Profile skill means `profiles.skills` only.** Industries, `job_titles_seeking`,
  `current_title` and work-history text are not skills.
- **Same skill means normalised string equality, not meaning:** NFKC, lowercase, then
  keep only `\p{L}\p{N}+#`. "Node.js" equals "NodeJS", "React.js" does not equal
  "React", and `C++`, `C#` and `C` stay distinct. An entry with an empty key is dropped.
- **Filtering only removes.** Score and reason are never touched, and nothing is
  re-scored. A list can be shorter than six, or empty.
- **Kept matched skills take the profile's spelling.**

## Problems solved

- **The real defect was `matched_skills`, not `missing_skills`.** 15 of 118 matched
  entries on 10 of 45 jobs were not profile skills: 4 job titles, 8 industries, and
  Python ×2 and Java ×1. Only 2 of 130 missing entries contradicted the profile. The
  model drifts on about 1 listing in 5. The live "Data Analyst / Boston" search removed
  3 matched entries on 2 of 10 listings.
- **Proving a SQL data fix equals the TypeScript rule:** export before-lists as one
  JSON value from SQL, with its SHA-256. Write it to the scratchpad and check the hash
  (it matched byte for byte). Run the TypeScript filter over it, and predict the
  post-update lists hash in Node using the same `id|a,b|c,d` lines joined by `\n` in id
  order. Node reproduced the DB's "before" hash first, which validated the method. After
  the real `UPDATE`, the DB hash equalled the prediction.
- **A red run needs the mutated copy to resolve deps.** A scratchpad copy of
  `agent/matcher.ts` failed on `Cannot find module 'zod'`, which is a false red. Fix it
  with the jiti alias `{ "@": repo, zod: repo + "/node_modules/zod" }`.

## Current state

- Lint, `tsc`, build and `openspec validate --all --strict` (3 specs) pass. The
  harness passed 10 of 10 with the 45-row cross-check at 0 differences. The red run
  (filter disabled) failed 9 cases and showed 11 differences.
- Dev DB: 55 jobs (10 added by "Data Analyst / Boston"). 0 bad matched and 0
  contradicting missing entries across all rows. `ai_usage` holds 13 rows, and runs
  stand at 11 completed and 5 failed.
- Committed with this memory file. Nothing deployed.

## Next session starts with

Feature 12, the Job Details Page: `/opsx-propose` (with `/architect`). Decisions to settle:

- **Gap-badge colour:** `build-plan.md` says red/orange, while `context/designs/job-details.png`
  uses purple. Design wins by default; confirm with the developer.
- **Research Company button:** the endpoint is Feature 13. Disabled button or empty
  state only?
- **Job Type:** `job_type` is always null for Adzuna (no employment type supplied), so
  decide how the card shows it. The design shows "—".
- **Description:** Adzuna's description is a cut-off snippet ("…"). Point to the full
  post.
- **Back to Jobs:** should it keep the list's `q` / `match` / `sort` / `page`?
- **404:** another user's job id, or a malformed one, must 404.
- **Linking:** `JobsTable` rows become links to `/find-jobs/[id]` (deferred from 11).
- **"You have" can be empty, and stored lists go stale after profile edits.** Consider
  re-applying `restrictToProfileSkills` against the current profile at render time.

## Open questions

- **Did invented matches inflate scores?** Affected scores were 10–75. Unmeasured.
- **Does the retry worsen a multi-user burst?** N refused searches can become 3N
  requests in about 2 s and push toward the per-minute 429. Bounded, but unmeasured.
- **Searches only read Adzuna's first page**, so repeating a query mostly says
  "all already in your list". Fetching later pages is a product decision.
- Next fetches bare `/find-jobs` twice per navigation. Harmless; cause unknown.
- The status region is verified in the DOM, not with NVDA/VoiceOver. The 300 ms
  debounce is unmeasured. `?page=1e20` falls back to page 1.
- `context/library-docs.md`'s Adzuna example still shows `lib/adzuna.ts` throwing.
  The shipped module is `agent/adzuna.ts` and never throws.
- Carried over from Feature 10:
  - `location_searched` records "Remote" as typed;
  - an empty `match_reason` is stored as `''`;
  - only four Adzuna markets are searched;
  - Feature 13 has no model path for Stagehand (do not reintroduce
    `OPENAI_API_KEY`);
  - `agent_logs` has no writer;
  - `ai_usage` retention is unhandled;
  - Feature 06 leftovers: save-success copy, resume input reset, tag input clear;
  - `maxDuration = 120` is unverified against the hosting plan.

## Testing notes

- **Sign in first.** Signing in is the developer's job; never automate it. The pane's
  session survives dev-server restarts on port 3000.
- **Live search without the form:** in the signed-in pane, `fetch("/api/agent/find",
  { method: "POST", body: JSON.stringify({ jobTitle, location }) })`. Then read
  `preview_logs` with `search: "agent/"`.
- **The pane runs "hidden"**: `setTimeout` throttles to about 1 s. Space scripted
  keystrokes with a `MessageChannel` wait.
- **SQL oracle technique**: hash the expected order in SQL
  (`encode(sha256(convert_to(string_agg(…), 'UTF8')), 'hex')`), and compare it with
  the rendered rows. `position(lower(needle) in lower(col))` is a wildcard-free
  contains check.
- **Rolled-back dry runs**: in a `do $$ … $$` block, run the statement, collect
  counts, and `raise exception` with them. The error rolls everything back,
  including DDL. Re-read a hash afterwards to prove it did.
- **Hash the rows you claim are untouched**, for example
  `id|match_score|match_reason|found_at|run_id|external_id`, before and after.
- **Adzuna probes** from a scratchpad script (keys read from `.env.local`, never
  printed) cost quota but no `ai_usage` slot. Keep a burst under about 15 a minute,
  or Adzuna answers 503 and 429 and the probe measures itself. `agent_runs` has no
  `created_at`; select runs by `job_title_searched`.
- **Harnesses: `jiti`** (`node_modules/jiti/lib/jiti.mjs`, `createJiti`) with
  `alias: { "@": repo }` imports `agent/*.ts`. `lib/env.ts` needs dummy
  `NEXT_PUBLIC_INSFORGE_*`.
- **Stubbing a provider under `next dev`**: an ESM preload via
  `NODE_OPTIONS=--import=file:///…`, launched through a `.cmd` wrapper as
  `runtimeExecutable` (inline `cmd /c set` did not reach the server). Revert
  `launch.json` afterwards.
- PostHog ingestion lags 10–30 s. Wait for the search's `job_search_started`
  before concluding a `job_found` is absent.
- `context/` docs are CRLF. Use the Edit tool, and count LF-only lines afterwards.
  `openspec/` files are LF.
- The scratchpad is wiped between sessions. Check that a harness's expected case
  count actually ran.
- Carried over: reset viewport emulation before trusting a click; never print
  `.env.local` values; `assets/CV …pdf` is the uncommitted extraction fixture;
  never click Save Profile while testing.
