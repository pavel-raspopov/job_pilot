## Why

A saved job is a row in a table and nothing more. The list shows a score bar, but not why
the job scored that way, which of the user's skills it wants, what it is missing, or what
the posting says. Every row is deliberately inert, because `/find-jobs/[id]` does not
exist. Feature 12 builds that page from the data Phase 3 already stores. It is also where
Feature 13's company research will appear.

## What Changes

- **A new page at `/find-jobs/[id]`** shows one of the signed-in user's saved jobs, with
  the content of `context/designs/job-details.png`:
  - Back to Jobs;
  - a header: company tile, title, company, a banded match-score pill, View Job Post;
  - four info cards: Salary Est., Location, Job Type, Date Found;
  - AI Match Reasoning;
  - Required Skills vs Your Profile ("You have" and "Gap skills");
  - Job Description;
  - a Company Research card with its empty state only;
  - Apply Now.
- **Not found looks the same in every case.** A malformed id, an unknown id and another
  user's job all render the same 404. The page never reveals which one it was.
- **The list's rows become links** to their job. **BREAKING** for the `find-jobs` spec,
  whose requirement said rows "SHALL NOT be a link". The link carries the list's current
  `q` / `match` / `sort` / `page`, so Back to Jobs returns to the exact view the user
  left, including after a refresh or in a new tab.
- **Every absent value has a stated presentation:**
  - an unscored job shows "Not scored", never 0%, and says it will be scored the next
    time a search finds it;
  - an empty skill list, a missing salary, job type, description or apply link each get
    one too.
- **External links open only `http:` or `https:` URLs**, in a new tab. Any other stored
  value renders no link.

### Source reconciliation (`/architect`, decided 2026-10-22)

| Conflict | Resolution |
|---|---|
| `project-overview.md` lists structured sections (responsibilities, requirements, nice to have, benefits, about company), a source, and a large score with a visual indicator. `build-plan.md` and `job-details.png` show one Job Description section and a score pill. | **Design and build plan win.** For Adzuna jobs the structured columns are always null; only `about_role`, a snippet, is written. The structured list describes URL import, which is out of scope. |
| Gap-skill colour: `build-plan.md` says red/orange and `project-overview.md` says red. The design and `ui-tokens.md` say purple (`bg-accent-muted` / `text-accent`). | **Purple, per the design and tokens.** A gap is something to learn, not an error. |
| The design shows an active "Research Company" button and copy telling the user to click it. The endpoint is Feature 13. | **Empty state with no button.** The copy promises no action. A control that leads nowhere is worse than none (the rule that kept list rows inert). Feature 13 adds the button. |
| `architecture.md` fixes `components/job-details/` at five files: `JobInfo`, `MatchScore`, `JobDescription`, `CompanyResearch`, `JobActions`. The design has eight visual blocks. | **Kept at five.** The blocks map onto them (design D2). |

### Language agreed

- **Details page**: `/find-jobs/[id]`, rendered on the server, showing the signed-in
  user's own job only.
- **Not found**: a malformed id, an unknown id, or another user's job. All three give one
  identical 404.
- **Description**: `jobs.about_role`, Adzuna's snippet, not the full posting.
- **View Job Post / Apply Now**: both open `external_apply_url` (Adzuna's redirect).
- **Unscored**: `match_score` is null. The pill reads "Not scored", never 0%.
- **Snapshot**: the score, reason and skill lists are shown together as one assessment
  made when the job was scored, with a caption that says so. They are not recomputed
  against the current profile.

## Capabilities

### New Capabilities

- `job-details`: viewing one saved job, covering access, not-found behaviour, each
  section's content and empty states, external links, the list-state round trip, and the
  research card's empty state.

### Modified Capabilities

- `find-jobs`: "Job list presentation" is **replaced** by "Job list presentation and row
  navigation". Every other sentence and scenario carries over unchanged, and each row now
  opens its job's details page and carries the current list view. It is a removal plus an
  addition rather than a MODIFIED block, because OpenSpec cannot drop the single
  scenario "Rows do not navigate", which now contradicts the product.

## Impact

**New:**
- `app/(app)/find-jobs/[id]/page.tsx` and `app/(app)/find-jobs/[id]/not-found.tsx`;
- `components/job-details/` with five components: `JobInfo`, `MatchScore`,
  `JobDescription`, `CompanyResearch`, `JobActions`.

**Modified:**
- `components/find-jobs/JobsTable.tsx` (the row link);
- `lib/utils.ts` (a safe external-URL helper, plus the score band moved here so the bar
  and the pill share it).

**Unchanged:** the schema, the API routes, the matcher, and PostHog. There is no new
event: the approved list in `code-standards.md` has none for viewing a job.

**Docs:** `context/ui-registry.md` (via `/imprint`) and `context/progress-tracker.md`.
`context/architecture.md` already lists the route and the five components.

**Dependencies:** none. Icons come from the already-installed `lucide-react`.

### Human gates

- **The click-through needs a signed-in Browser pane.** Signing in is the developer's job.
- **"Another user's job" cannot be exercised live.** The dev DB has one user, and creating
  accounts is out of bounds. It is verified by reading the query (`id` and `user_id` both
  filtered) and the `jobs` RLS policy, and the limitation is stated.

## Non-goals

- **Company research itself**: the endpoint, the button and the dossier rendering
  (Feature 13).
- **Structured job sections** (responsibilities and the rest) and the source badge on
  this page.
- **Re-scoring or re-filtering** a job against the current profile.
- **Previous / next job navigation** (out of product scope).
- **A page-view analytics event**, per-page metadata, or a `loading.tsx`.
- **A test framework.** Verification is `npm run lint`, `npm run build`,
  `openspec validate --all --strict`, and a manual click-through in the Browser pane,
  including edge-case rows staged in the dev DB and restored afterwards.
