# Memory — Feature 12 Job Details Page

Last updated: 2026-10-22

## What was built

Feature 12 is done. OpenSpec change `add-job-details-page`: proposed with `/architect`,
applied, reviewed (2 Minors, both fixed) and archived to
`openspec/changes/archive/2026-10-22-add-job-details-page/` on 2026-10-22. A new main spec,
`openspec/specs/job-details/spec.md`, has 7 requirements. In `find-jobs`, "Job list
presentation" was replaced by "Job list presentation and row navigation". The decision
record is in `context/progress-tracker.md` under "Feature 12 Job Details Page".

Earlier the same day: `filter-match-skills` (commit `6945879`) holds the skill lists to
`profiles.skills` after the model replies.

- **New:**
  - `app/(app)/find-jobs/[id]/page.tsx`, a server component that validates the id
    with `z.uuid()`, then reads with `.eq("id").eq("user_id").limit(1)` and
    `parseJobRow`;
  - `app/(app)/find-jobs/[id]/not-found.tsx`;
  - `components/job-details/`: `JobInfo`, `MatchScore`, `JobDescription`,
    `CompanyResearch` and `JobActions`. All are server-only, with no `"use client"`.
- **Modified:**
  - `components/find-jobs/JobsTable.tsx`: the title cell holds the row's one
    stretched `<Link>` (`::after` over a `relative <tr>`), carrying the rendered
    `params`;
  - `lib/utils.ts`: `scoreBand()` (shared by the bar and the pill),
    `safeExternalUrl()` (http/https only) and `COMPANY_NOT_PROVIDED`.
- **Docs:** `context/ui-registry.md` has 15 new or updated entries, including Row link,
  Company fallback, Match score pill, Fact card (the third Card padding override) and
  External link. `context/progress-tracker.md` has Feature 12 ticked, the status set
  to Feature 13, and the decision entry.

## Decisions made

- **Design and build plan win over `project-overview.md`'s structured job sections**,
  which are always null for Adzuna and belong to the out-of-scope URL import.
- **Gap skills are purple** (`bg-accent-muted text-accent`), per the design and tokens.
- **The research card has no button until Feature 13.** It shows an empty state whose
  copy promises no click.
- **Back to Jobs restores the list view** through `q` / `match` / `sort` / `page` in the
  details URL, re-parsed by `parseJobListParams`.
- **The match assessment is one captioned snapshot**: never re-filtered against the
  current profile, so the lists cannot contradict the reason.
- **Not found is one identical 404** for a malformed id, an unknown id and another
  user's job.
- **Company fallback:** `COMPANY_NOT_PROVIDED` where the company stands alone, and
  omitted inside sentences.
- **The pill's mid band is neutral with an orange dot**, because `text-warning` text
  fails AA contrast.

## Problems solved

- **OpenSpec cannot drop one scenario from a MODIFIED requirement.** Its validator
  rejects scenario loss, and there is no scenario-level REMOVED. Retire it by
  REMOVING the requirement (with a Reason and Migration) and ADDING it under a new
  name, carrying the other scenarios over verbatim. When archiving, place the
  replacement where the old one stood.
- **Validate the uuid before querying.** A malformed id comes back from PostgREST as
  an *error*, not as no rows, so it would read as a load failure.
- **React renders `javascript:` hrefs.** `safeExternalUrl` is the guard. A server
  component's props never reach the client payload, so a rejected URL is not in the
  HTML at all.
- **Stretched row link:** `position: relative` on `<tr>` works in the pane's Chromium.
  This was proven with real clicks on the company and date cells and a 900 px focus
  ring.
- **Filter debounce versus a row click:** the blur flush's `router.replace` loses to
  the link's push, so the job opens.

## Current state

- Lint, `tsc`, build (route table lists `ƒ /find-jobs/[id]`) and
  `openspec validate --all --strict` (4 specs) all pass. The helper harness passed
  17 of 17, and its red run (a pass-through URL guard) failed 8.
- Dev DB is unchanged by Feature 12: 55 jobs, and row `0664e5f7…` was restored twice
  from `jobs_f12_backup` with an identical hash. The backup table has been dropped.
- Committed with this memory file. Nothing deployed.

## Next session starts with

Feature 13, the Company Research Agent: `/opsx-explore` or `/opsx-propose` with
`/architect`. Settle first:

- **Model path:** Stagehand has no model path. Do not reintroduce `OPENAI_API_KEY`;
  check whether Stagehand can use the InsForge gateway.
- **Browserbase credentials** are a human gate: check the env names only.
- **Dossier shape:** `build-plan.md` has 9 fields, and the research card must render
  all of them.
- **The card:** Feature 13 adds the Research Company button (a real `disabled` /
  in-flight async button) and replaces `CompanyResearch.tsx`'s body.
- **Analytics:** the `company_researched` event.
- **Rate limit:** each research run spends an AI slot.

## Open questions

- **The load-failed card has never rendered.** A temporary `REVOKE SELECT ON jobs FROM
  authenticated` was denied by the permission system, and the grants were checked
  unchanged. The developer can allow that one revoke/grant pair, or a temporary code
  fault, to prove it.
- **Another user's job has not been tested live.** InsForge's `run-raw-sql` refuses
  `set_config`, so `auth.uid()` cannot be impersonated. The proof today is the query's
  two filters plus `jobs_select_own` with RLS enabled.
- The 404 status under `next start` (production) is unverified; dev returns 404.
- The whole-row link blocks text selection in list rows. That is a product
  trade-off, not a bug.
- Did invented matches inflate scores before `filter-match-skills`? Unmeasured.
- Does the Adzuna 503 retry worsen a multi-user burst? Unmeasured.
- Searches read only Adzuna's first page. Next fetches bare `/find-jobs` twice per
  navigation (harmless). `?page=1e20` falls back to page 1.
- `context/library-docs.md`'s Adzuna example still shows `lib/adzuna.ts` throwing. The
  shipped module is `agent/adzuna.ts`, which never throws.
- Carried over from Feature 10:
  - "Remote" is stored as typed;
  - an empty `match_reason` is stored as `''` (the details page reads it as null via
    `parseJobRow`);
  - only four markets are searched;
  - `agent_logs` has no writer;
  - `ai_usage` retention is unhandled;
  - Feature 06 leftovers;
  - `maxDuration = 120` is unverified.

## Testing notes

- **Sign in first.** Signing in is the developer's job; never automate it.
  **Restarting the preview server can sign the pane out.** It happened on 2026-10-22,
  so ask for a sign-in before live checks.
- **Staged edge states:** `create table jobs_f12_backup as select * … where id = …`,
  hash the row with `to_jsonb`, update it to each state, restore it by updating every
  column from the backup, check the hash is identical, then drop the backup.
- **Pane quirks:**
  - Screenshots often time out. Retry, or use DOM checks.
  - An emulated viewport is dropped on navigation, so re-check `innerWidth`.
  - Reset to the desktop preset before trusting click coordinates (the frame scale
    is about 1.46).
  - A `javascript_tool` script that navigates loses its return value. Start the
    navigation with `setTimeout`, then read in a second call.
- **Racing a debounce:** the click harness is too slow, because the debounce lands
  first. Instead set the value through React's native setter
  (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set`),
  dispatch `input`, then `blur()` and `link.click()` in the same script.
- **Overflow probes:** compare `scrollWidth > clientWidth` on the element.
  `getBoundingClientRect` cannot see text spilling out of its own box.
- **Red runs:** point the harness at a mutated scratchpad copy. When the copy imports
  packages, alias them to the repo's `node_modules`.
- **SQL oracles:** hash the expected order with `string_agg`, use rolled-back
  `do $$ … raise exception $$` dry runs, and hash the rows you claim are untouched.
- **Adzuna probes** cost quota. Keep bursts under about 15 a minute.
- PostHog ingestion lags 10–30 s.
- `context/` docs are CRLF; use the Edit tool. `openspec/` and `memory.md` are LF.
- The scratchpad is wiped between sessions. Check that a harness's case count
  actually ran.
- Never print `.env.local` values. `assets/CV …pdf` is the uncommitted extraction
  fixture. Never click Save Profile while testing.
