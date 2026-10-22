## 1. Shared helpers

- [x] 1.1 In `lib/utils.ts`, add `scoreBand(score)` (design D3) and `safeExternalUrl(value)`
  (D6), each with a docblock giving its reason. Switch `JobsTable`'s local band function to
  `scoreBand`, mapping each band to the same bar classes as today. Verify with
  `npx tsc --noEmit` and `npm run lint`, and read the diff to confirm the bar classes per
  band are unchanged.
- [x] 1.2 Write a scratchpad harness (`jiti`, `@` alias) for both helpers:
  - `scoreBand` at 0, 49, 50, 69, 70 and 100;
  - `safeExternalUrl` for `https://…`, `http://…`, `javascript:alert(1)`,
    `JAVASCRIPT:alert(1)`, `  javascript:alert(1)` (leading spaces), `java\tscript:…`,
    `data:text/html,…`, `/relative`, `''`, `null` and `not a url`.

  Only the first two return a URL. Verify the harness prints the number of cases run
  and that all passed, then run it once against a copy of `safeExternalUrl` that returns
  its input unchanged, and verify that run fails.

## 2. Route, not-found and load failure

- [x] 2.1 Create `app/(app)/find-jobs/[id]/page.tsx` with D1's loading sequence, the
  standard container and column, the Back to Jobs link (D5), the load-failed card (D7),
  the attribution line (D12), and for now just the `<h1>` title. Create
  `app/(app)/find-jobs/[id]/not-found.tsx` (D7). Verify with `npx tsc --noEmit` and
  `npm run lint`.
- [x] 2.2 In the signed-in Browser pane, check each address with `fetch` and read the
  response status, then the rendered page:
  - a real job id gives 200 and its title;
  - `/find-jobs/not-a-uuid` gives 404 and "Job not found";
  - a well-formed UUID that does not exist gives 404, a page byte-identical to the
    previous case apart from framework ids;
  - `/find-jobs/<id>?sort=oldest&page=3&q=react` gives a Back href of
    `/find-jobs?q=react&sort=oldest&page=3`;
  - `?sort=bogus&page=-4&q=https://evil.example` gives a Back href that starts with
    `/find-jobs` and holds only valid keys.

  Verify the server log shows no unhandled error for any of them.

## 3. The five components

- [x] 3.1 `components/job-details/JobInfo.tsx`: the header card (D8), the score pill (D3)
  and the four fact cards (D8), with View Job Post per D6. Render it from the page.
  Verify in the pane that the header and facts match `context/designs/job-details.png`
  for a scored job, and screenshot it.
- [x] 3.2 `components/job-details/MatchScore.tsx` (D9). Verify in the pane that both
  cards and the snapshot caption render for a scored job with both lists filled.
- [x] 3.3 `components/job-details/JobDescription.tsx` (D10). Verify in the pane that line
  breaks are preserved and the preview note links out.
- [x] 3.4 `components/job-details/CompanyResearch.tsx` (D11). Verify in the pane that it
  shows the empty state with no `button` element inside the card (check the
  accessibility tree).
- [x] 3.5 `components/job-details/JobActions.tsx` (D6). Verify in the pane that Apply Now
  names the company, that its `href` equals the stored `https` URL, and that it has
  `target="_blank"` and `rel="noopener noreferrer"`.
- [x] 3.6 Verify that `grep -rn "use client" components/job-details` returns nothing, and
  run `npx tsc --noEmit` and `npm run lint`.

## 4. The row link

- [x] 4.1 In `components/find-jobs/JobsTable.tsx`, make the title cell's content the
  row's link and add `relative` to `<tr>` (D4). Update the docblock that says rows are
  not links. Verify with `npx tsc --noEmit` and `npm run lint`.
- [x] 4.2 In the pane, from `/find-jobs?q=<term>&sort=oldest&page=2`, or the deepest
  filtered page the dev data allows:
  - click the **salary** cell of a row, then the **date** cell of another, and verify
    each opens that row's job;
  - verify Back to Jobs returns to the same `q`, `sort` and `page`;
  - Tab through the table and verify one stop per row, a whole-row focus ring, and the
    accessible name "{role} at {company}" (accessibility tree). Enter opens the job.

## 5. Edge states on a staged row (dev DB, restored afterwards)

- [x] 5.1 Pick one job. Run `create table jobs_f12_backup as select * from jobs where
  id = '<id>'`. Record the SHA-256 of that row's full `to_jsonb` and the whole table's
  row count.
- [x] 5.2 Update the row to the **unscored** state (`match_score`, `match_reason`,
  `matched_skills` and `missing_skills` all null). Verify the pill reads "Not scored"
  with no percentage, both assessment cards show the unscored copy, and the list shows
  the row's score as absent, not 0%.
- [x] 5.3 Update it to **scored with an empty reason (`''`) and both lists empty**.
  Verify the "No reasoning was recorded" text and both empty-list texts.
- [x] 5.4 Update it to **null `salary`, `job_type`, `about_role` and a 200-character
  `location`**. Verify that three facts read "Not provided" in the accessibility tree
  and show "—" visibly, that the location truncates with its full text in the DOM, and
  that the description empty state shows with no preview note.
- [x] 5.5 Update `external_apply_url` to `javascript:alert(1)`, then to `''`. Each time,
  verify that no View Job Post or Apply Now link exists in the DOM, that the description
  has no full-posting link, and that "No application link was provided for this job."
  is shown.
- [x] 5.6 Restore the row from `jobs_f12_backup`, then drop the backup. Verify the row's
  `to_jsonb` hash equals the one from 5.1, the table's row count is unchanged, and
  `jobs_f12_backup` no longer exists.

## 6. Whole-page checks

- [x] 6.1 **Ownership** (human gate: one user in the dev DB). Show the `jobs_select_own`
  policy via `get-table-schema`, and quote the page's query showing both `id` and
  `user_id` filters. State in the tracker that a second user was not exercised live.
- [x] 6.2 Narrow viewport (`resize_window` mobile, then reset to desktop). Verify that the
  page body does not scroll horizontally, that the fact cards stack, and that the header
  button wraps under the title rather than overflowing.
- [x] 6.3 Verify that `read_console_messages` shows no errors and no hydration warnings on
  the details page or the list, and that the server log is clean.
- [x] 6.4 Run `npm run lint`, `npx tsc --noEmit`, `npm run build` and
  `openspec validate --all --strict`, and show the output. All four must pass, and the
  build's route table must list `/find-jobs/[id]`.

## 7. Docs and close-out

- [x] 7.1 Run `/imprint` to record in `context/ui-registry.md` the five components, the
  score pill, the fact card (the third Card padding override), the skill pills, the
  details-page empty states and the row link pattern. Update the **Data table** entry's
  sentence saying rows are not links. Verify by reading the neighbouring entries for style.
- [x] 7.2 Update `context/progress-tracker.md`: tick Feature 12, set the current status
  to Feature 13, and add a decision entry with the `/architect` resolutions and the 6.1
  limitation. Verify by reading the neighbouring entries.
- [x] 7.3 *(Done. Fresh lint, `tsc`, build, validate and harness all passed.
  `/feature-review` found 2 Minors: a title with no spaces overflowed the header, and
  a null company had four different fallbacks. Both are fixed (`break-words`, and
  `COMPANY_NOT_PROVIDED` plus omission inside sentences) and re-verified live. The
  load-failed card and another user's job remain unexercised, as recorded in the
  tracker. Archive, memory and commit follow.)* Run `/verification-before-completion`, then `/feature-review`, then
  `/opsx-archive`. Then `/remember save`, and commit on `main` with a one-line message,
  staging `memory.md` with the work.
