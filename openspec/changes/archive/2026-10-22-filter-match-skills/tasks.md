## 1. Filter in the matcher

- [x] 1.1 In `agent/matcher.ts`, add `skillKey()` (design D2) and an exported pure
  `restrictToProfileSkills(match, profileSkills)` (D3) beside `mapScoredMatches`. Give
  each a doc comment saying why, citing the 2026-10-22 measurement. Leave the prompt, the
  tool schema and `mapScoredMatches` unchanged. Verify with `npx tsc --noEmit` and
  `npm run lint`.
- [x] 1.2 In `scoreJobs`, apply the filter to every non-null result just before the
  final log, and log the count-only `removed skills not in the profile` line when
  anything was removed (D4). Correct the model-choice comment's "invented zero skills"
  sentence to say what the 45-job sample showed and that the filter now enforces it.
  Verify with `npx tsc --noEmit` and `npm run lint`, and read the diff to confirm that
  scores, reasons, placement and retries are untouched.

## 2. Offline harness

- [x] 2.1 Write a scratchpad harness (`jiti`, `@` alias, dummy `NEXT_PUBLIC_INSFORGE_*`)
  that imports `restrictToProfileSkills` and runs cases (a)–(j) from design D6. Verify
  that it prints 10 cases run and 10 passed.

## 3. Correct the dev-DB rows

- [x] 3.1 Snapshot (D5 step 1) with InsForge MCP `run-raw-sql`, read-only. Record the
  proposal's counts (expected 15 / 10 jobs and 2 / 1 job) and the SHA-256 of the
  untouched columns over all 45 rows.
- [x] 3.2 Dry-run the `UPDATE` in a `do $$ … $$` block that raises its counts (D5
  step 2). Verify that it reports 11 rows changed and 0 / 0 after, and that a re-read
  shows the data unchanged.
- [x] 3.3 Cross-check (D5 step 3). Export the affected rows' lists and the profile's
  skills, run `restrictToProfileSkills` over them in the harness, and diff the result
  against the SQL's post-update lists from a second dry run. Verify 0 differences across
  all 11 rows.
- [x] 3.4 Run the real `UPDATE`, then re-run the snapshot. Verify 11 rows updated, 0 bad
  matched entries, 0 contradicting missing entries, 45 jobs, and an unchanged hash.

## 4. Static verification

- [x] 4.1 Run `npm run lint`, `npx tsc --noEmit`, `npm run build` and
  `openspec validate --all --strict`, and show the output. All four must pass.

## 5. Live verification (human gate: the developer signs in to the Browser pane)

- [x] 5.1 Snapshot the job count and the user's `ai_usage` rows. From the signed-in
  Browser pane, run one search for a title with no saved listings yet. Verify that the
  run completes, `ai_usage` goes up by exactly 1, and the server log shows the
  `scored N of N` line. Note whether the `removed skills` line appears and with what
  counts. Re-run the proposal's SQL check over all rows and verify 0 and 0.

## 6. Docs and close-out

- [x] 6.1 Update `context/library-docs.md` (matcher section: the skill lists are filtered
  against `profiles.skills` after the reply, and why prompt wording is not enough) and
  `context/progress-tracker.md` (a new entry, plus the "Open, not fixed here"
  `missing_skills` note re-diagnosed). Verify by reading the neighbouring entries for
  style.
- [x] 6.2 *(Done. Fresh lint, `tsc`, build and validate passed, plus a red run with the
  filter disabled: 9 of 10 cases failed and 11 rows differed. `/feature-review` found
  1 Minor, the spec scenario "every saved listing", now "every scored listing". Archive,
  memory and commit follow.)* Run `/verification-before-completion`, then `/feature-review`, then
  `/opsx-archive`. Then `/remember save`: update `memory.md`'s open question and set the
  next session to Feature 12 `/opsx-propose`. Commit on `main` with a one-line message
  and stage `memory.md` with the work.
