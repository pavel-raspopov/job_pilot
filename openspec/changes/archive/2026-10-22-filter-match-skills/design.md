## Context

See `proposal.md` (Why). The requirement is in `specs/job-discovery/spec.md`. This
document covers only how it is met.

These facts constrain the approach:

- **`scoreJobs(profile, jobs)` already has the profile in hand** and returns an
  index-aligned `(ScoredMatch | null)[]`. The route writes `matchedSkills` /
  `missingSkills` straight into `jobs` for both new inserts and the unscored-row refill
  (`route.ts` around lines 304 and 426). Filtering inside `scoreJobs` therefore covers
  both write paths without touching the route.
- **Each list is already capped at `MAX_SKILLS_PER_LIST` (6) twice**: by `maxItems` in
  the tool schema, and by a `.slice` in `mapScoredMatches`. So an invented entry has
  used up its slot before any filter runs, and filtering can only shorten a list.
- **A retry merges results across attempts** (`results.map((m, i) => m ?? placement…)`).
  A filter applied once to the final array covers every attempt.
- **`profiles.skills` defaults to `{}`**, and the route accepts a profile that has a
  current title but no skills.
- **The dev data is ASCII.** All 15 bad matched entries and both contradicting missing
  entries fail or match on plain case-insensitive equality. Normalisation changed no
  count in the measurement.

### Files in scope

**Modified:** `agent/matcher.ts`, plus the docs named in the proposal.

**Frozen:** `app/api/agent/find/route.ts`, `agent/adzuna.ts`, `lib/parse-job.ts`,
`types/index.ts`, the prompt and tool schema inside `agent/matcher.ts`, and all UI.
Changes to these are limited to one-line type or compile fixes, and only if a named
verify command fails.

## Goals / Non-Goals

**Goals:** no saved matched skill outside `profiles.skills`, and no saved missing skill
inside it. This holds for every listing written from now on and for every dev row today.

**Non-Goals:** semantic equivalence, prompt changes and re-scoring. See the proposal's
Non-goals.

## Decisions

### D1. A pure exported filter, applied once at the end of `scoreJobs`

`restrictToProfileSkills(match: ScoredMatch, profileSkills: string[]): ScoredMatch`
lives in `agent/matcher.ts` beside `mapScoredMatches`. `scoreJobs` maps it over the
non-null results just before its final log and return. It is pure, so the offline
harness can import and drive it directly.

*Alternatives:* (a) filter inside `mapScoredMatches`. Rejected because that function is
about placing entries by index, and keeping it profile-free keeps its drop reasons
honest. (b) Filter in the route. Rejected because the route is frozen, and `ScoredMatch`
is the matcher's contract, so the matcher should keep it.

### D2. Comparison key

`skillKey(s) = s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}+#]/gu, "")`

This keeps letters and digits in any script, plus `+` and `#`. That way `C++`, `C#` and
`C` stay distinct, while "Node.js", "NodeJS" and "node js" collapse to one key. **An
entry whose key is empty** (punctuation only) is not a skill. It is removed from both
lists and never matches anything. Without this guard, two empty keys would compare
equal.

*Alternative:* `trim().toLowerCase()` alone. It is equal to this key on today's data,
but it would leave "Node.js" against "NodeJS" listed as missing, the exact contradiction
this change exists to stop.

### D3. Order of operations per listing

1. Build a `Map<key, profileSpelling>` from `profileSkills`. The first spelling wins if
   the profile itself repeats a skill.
2. **Matched:** in the model's order, keep an entry only if its key is in the map, emit
   the profile's spelling, and skip a key already emitted.
3. **Missing:** in the model's order, drop an entry whose key is in the map or is
   empty, and skip a key already emitted. A skill the model put in both lists ends up
   matched only, because its key is in the map.
4. `matchScore` and `matchReason` are passed through untouched.

The filter only removes entries, so the existing cap (`maxItems` plus the `.slice` in
`mapScoredMatches`) still bounds each list at 6. Both stay as they are.

*Alternative:* drop the schema's `maxItems` so the model lists more entries and real
skills fill the slots invented ones leave. Rejected because it changes the tool schema
(frozen, re-benchmark required). The `maxItems` comment at `buildMatchingTool` also
records that a capped array has side effects, so changing it is a separate
investigation.

### D4. Logging: counts only

When any entry is removed in a batch, `scoreJobs` logs one line:
`console.log("[agent/matcher] removed skills not in the profile", { listings, matched,
missing })`. These are three integers: listings affected, matched entries removed and
missing entries removed. No skill strings are logged, which follows the module's
"counts and shapes only, never values" rule. It uses info level, because the outcome is
correct and the line measures how often the model drifts.

### D5. Dev-DB correction: one SQL statement, guarded

The cleanup applies D2 and D3 in SQL:
`regexp_replace(lower(normalize(s, NFKC)), '[^[:alnum:]+#]', '', 'g')`. With an ASCII
locale `[:alnum:]` may differ from `\p{L}\p{N}` on non-ASCII input, and the dev data has
none. It uses `WITH ORDINALITY` to keep the model's order and `DISTINCT ON` the key. It updates only rows whose lists would change. It is run in this order:

1. **Snapshot.** Store the counts from the proposal's table, and a SHA-256 over every
   row's `id|match_score|match_reason|found_at|run_id|external_id` (the columns that must
   not change).
2. **Dry run.** Run the `UPDATE` inside a `do $$ … $$` block that collects the affected
   row count and the post-update contradiction counts, then raises an exception carrying
   them. That rolls everything back. Expect 11 rows, 0 bad matched entries, 0
   contradicting missing entries.
3. **Cross-check against the TypeScript.** Export the 11 rows' current lists and the
   profile's skills as JSON, run `restrictToProfileSkills` over them in the harness, and
   compare the result with the dry run's post-update lists (returned from a second dry
   run as JSON). The two implementations must agree on every row before the real run.
4. **Real run**, then re-run the snapshot. The counts drop to 0. The hash of the
   untouched columns is unchanged. The total is still 45 jobs.

*Alternative:* re-score the affected rows through the gateway. Rejected because it costs
calls and quota, and changes scores the requirement says filtering must not change.

### D6. Verification

- **Offline harness** (scratchpad, `jiti` with the `@` alias, dummy
  `NEXT_PUBLIC_INSFORGE_*`). It imports `restrictToProfileSkills` and runs table cases:
  (a) an industry, a title and an invented skill in matched are removed;
  (b) "nodejs" in missing against profile "Node.js" is removed;
  (c) a skill in both lists ends up matched only, in the profile's spelling;
  (d) "node.js" in matched is emitted as "Node.js";
  (e) duplicate keys in matched ("React", "react") are emitted once;
  (f) `C++`, `C#` and `C` stay distinct;
  (g) a punctuation-only entry is removed from both lists;
  (h) an empty profile gives an empty matched list and missing unchanged;
  (i) 6 matched entries with 3 invented give exactly the 3 real ones, in model order;
  (j) score and reason are identical by value.
  It prints the number of cases that ran.
- **Live:** one search for a title not yet saved. The `removed skills` line may or may
  not appear, because the drift is roughly 1 listing in 5. Whether it appears or not,
  re-running the proposal's SQL check over the new rows must give 0 and 0.

## Risks / Trade-offs

- **[A real paraphrase in matched is dropped]** ("React.js" when the profile says
  "React") → This is the safe direction: the badge under-claims. The prompt already
  asks for the candidate's own list, and the dev data showed no such case.
- **[A paraphrase in missing survives]** → This is the 2-of-130 class reduced to
  spelling-only. Semantic matching is a non-goal. Feature 12 can show it as is.
- **[A listing can end with zero matched skills while its reason praises industry
  fit]** → That is correct. Industry is part of the score, not a skill. Feature 12 needs
  an empty state for "You have".
- **[SQL and TypeScript normalisation can diverge on non-ASCII skills]** → Only the
  one-off cleanup uses SQL, and D5 step 3 proves agreement on the actual rows.

## Migration Plan

No schema change. The dev-DB correction is D5. Rollback for the code is a revert of
`agent/matcher.ts`. The data correction only removes entries the requirement forbids, so
it is not rolled back. The removed values are recorded, as counts and categories, in the
proposal.
