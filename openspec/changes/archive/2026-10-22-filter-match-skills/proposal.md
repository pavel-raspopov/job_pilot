## Why

The `job-discovery` spec already says matched skills "SHALL be drawn from the user's
profile and SHALL NOT be invented", but nothing enforces it. The prompt asks for it, and
the model ignores the request on a fifth of listings. Measured in the dev DB on
2026-10-22 (45 jobs, one profile with 43 skills):

| Check | Result |
|---|---|
| `matched_skills` entries not in `profiles.skills` | **15 of 118, on 10 of 45 jobs** |
| …job titles taken from `job_titles_seeking` ("Frontend Engineer") | 4 |
| …industries taken from `industries` ("retail", "healthcare", "e-commerce") | 8 |
| …skills the candidate does not have (Python ×2, Java ×1) | 3 |
| `missing_skills` entries that are in `profiles.skills` | 2 of 130 (React, TypeScript, on one job) |

Feature 12 is about to show these lists as "You have" and "Gap skills" badges, and
Feature 13 feeds them into its dossier prompt. A green "You have: Python" badge for a
candidate without Python is a false claim the product makes about the user. A re-found
listing is never re-scored, so these rows will not correct themselves.

## What Changes

- **After the model replies, the matcher keeps only profile skills in `matched_skills`.**
  An entry survives only if it equals one of the user's `profiles.skills` after
  normalising case, whitespace and punctuation (`+` and `#` are kept, so `C++` is not
  `C`). The surviving entry takes the profile's spelling. Duplicates collapse.
- **`missing_skills` loses any entry that is a profile skill**, by the same comparison.
- **A filtered list can be shorter than the model's.** The tool schema caps each list at
  6, so an invented entry has already taken a slot a real skill could have used. The
  filter cannot recover that slot, and re-asking the model is a non-goal.
- **The score and the reasoning are untouched.** Nothing is re-scored, and the prompt
  does not change.
- **The 11 affected dev-DB rows are corrected once with SQL** that applies the same rule.
  Only the two skill columns change. This follows the precedent of the earlier dev-DB
  cleanup: a one-off fix recorded in the docs, not a migration, since nothing is
  deployed.

### Source reconciliation

No conflict. `build-plan.md` (Feature 10), `architecture.md`, the `job-discovery` spec and
the matcher prompt all define matched skills as skills the user has, and missing skills as
skills the user lacks. The code is the only outlier. `library-docs.md` already records
the lesson that applies here (resume extraction): prompt wording does not stop invention,
and a structural check does.

### Language agreed (`/architect`, 2026-10-22)

- **Profile skill**: an entry in `profiles.skills` and nothing else. Industries, titles
  sought, the current title and work-history text are not skills.
- **Same skill**: string equality after normalisation, not meaning. "Node.js" equals
  "NodeJS", but "React.js" does not equal "React", and "AWS" does not equal "Amazon Web
  Services".
- **Filter**: entries are only ever removed. Nothing is added, re-worded or re-scored.
- **Existing rows**: the dev DB's rows only.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `job-discovery`: the scoring requirement now also forbids a missing skill that the user
  has, and its scenarios make both rules testable. That includes a profile with no
  skills, which gets an empty matched list.

## Impact

**Modified:** `agent/matcher.ts` (a pure filter applied to `scoreJobs`'s results, plus a
count-only log line).

**Unchanged:** `app/api/agent/find/route.ts`, the prompt, the tool schema, the model,
the rate limiter, the UI and the schema.

**Data:** an `UPDATE` on `jobs.matched_skills` / `jobs.missing_skills` in the dev DB, run
through InsForge MCP `run-raw-sql` after a rolled-back dry run.

**Docs:** `context/library-docs.md` (the matcher's skill-list rule) and
`context/progress-tracker.md`. The matcher's model-choice comment says "invented zero
skills" and is corrected to say what the wider sample showed.

**Dependencies:** none.

### Human gates

- **The live check needs a signed-in Browser pane.** Signing in is the developer's job.
- **One live search spends Adzuna quota and one `ai_usage` slot.** It needs
  `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` (`.env.local`, names checked, values never printed)
  and the InsForge AI gateway.

## Non-goals

- **Semantic matching or an alias table.** A paraphrase in `missing_skills` ("React.js"
  when the profile says "React") survives, and a paraphrase in `matched_skills` is
  dropped, which errs on the safe side.
- **Changing the prompt or the model.** The model-choice comment requires a re-benchmark
  for a prompt change, and the filter makes the guarantee whatever the prompt says.
- **Re-scoring affected listings.** The affected scores are low (10–75), and re-scoring
  costs gateway calls for a number the filter does not touch.
- **Keeping stored lists in step with later profile edits.** A list describes the profile
  as it was when the job was scored.
- **A test framework.** Verification is `npm run lint`, `npx tsc --noEmit`,
  `npm run build`, `openspec validate --all --strict`, an offline harness over the
  filter, SQL counts before and after, and one live search.
