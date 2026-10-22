## Context

See `proposal.md` (Why, and the source reconciliation). The requirements are in
`specs/job-details/spec.md` and `specs/find-jobs/spec.md`. This document covers how they
are met.

These facts constrain the approach:

- **Next 16:** `params` and `searchParams` are Promises and must be awaited. `notFound()`
  renders the nearest `not-found.tsx`, with a 404 status for a non-streamed response. A
  `Link` with the default `prefetch` prefetches a dynamic route only down to the nearest
  `loading.js`. This route has none, so 20 row links do not cause 20 job reads.
- **The list page's session and loading pattern** (`app/(app)/find-jobs/page.tsx`):
  `createInsforgeServer()`, then `auth.getCurrentUser()`. A failed session read is a
  *load failure*, not an empty result. Rows are read with `select("*")` and mapped
  through `parseJobRow`, never cast.
- **What a saved Adzuna job actually holds:** `about_role` is a snippet, often ending
  in "…". `job_type` is always null. `salary` is preformatted text or null. The
  structured columns are null. `external_apply_url` is Adzuna's redirect. Since
  `filter-match-skills`, the skill lists can be empty, and an unscored row has null for
  all four scoring columns.
- **`context/architecture.md` fixes `components/job-details/` at five files.**
  `components/find-jobs/` stays at four.
- **The list's view state is already a validated value.** `parseJobListParams` never
  throws, and `jobListHref(pathname, params)` writes only non-default values to a
  pathname the caller fixes.

### Files in scope

**New:**
- `app/(app)/find-jobs/[id]/page.tsx` and `app/(app)/find-jobs/[id]/not-found.tsx`;
- `components/job-details/` with five files: `JobInfo.tsx`, `MatchScore.tsx`,
  `JobDescription.tsx`, `CompanyResearch.tsx`, `JobActions.tsx`.

**Modified:**
- `components/find-jobs/JobsTable.tsx` (the row link, and the shared band helper);
- `lib/utils.ts` (`scoreBand`, `safeExternalUrl`).

**Docs:** `context/ui-registry.md` (`/imprint`) and `context/progress-tracker.md`.

**Frozen:**
- `app/api/**`, `agent/**`, `lib/parse-job.ts`, `lib/job-list-params.ts` (reused, not
  changed), `types/index.ts`;
- `SearchControls.tsx`, `JobFilters.tsx`, `JobsPagination.tsx`, the schema.

Changes to these are limited to one-line type or compile fixes, and only if a named
verify command fails.

## Goals / Non-Goals

**Goals:** a server-rendered page with no client JavaScript of its own; every absent value
presented on purpose; links that cannot carry a dangerous scheme; and a list round trip
that survives a refresh.

**Non-Goals:** client interactivity on this page, which arrives with Feature 13's button.
Also out are the structured sections, analytics and per-page metadata. See the proposal's
Non-goals.

## Decisions

### D1. Route and data loading

`page.tsx` is an async Server Component taking `params: Promise<{ id: string }>` and
`searchParams: Promise<RawSearchParams>`. In order:

1. `listParams = parseJobListParams(await searchParams)` and
   `backHref = jobListHref("/find-jobs", listParams)`.
2. **Validate the id before touching the database.** If `z.uuid().safeParse(id)` fails,
   call `notFound()`. A malformed id sent to PostgREST comes back as a 22P02 *error*,
   which step 4 would report as a load failure, so a typo'd URL would wrongly say
   "try again".
3. Read the session as the list page does. An auth error or a missing user means
   `loadFailed`.
4. `insforge.database.from("jobs").select("*").eq("id", id).eq("user_id", userId).limit(1)`.
   - An error means `loadFailed` (logged with `console.error`, tagged
     `[find-jobs/[id]/page]`).
   - No row means `notFound()`.
   - A row that `parseJobRow` rejects means `loadFailed`, logged as malformed.
5. Compute `postingUrl = safeExternalUrl(job.external_apply_url)` once, and pass it
   down.

`.limit(1)` and taking `data[0]` is used instead of `.maybeSingle()`. It relies only on
calls the list page already exercises against InsForge.

**Ownership is enforced twice:** once by the `user_id` filter, and once by the `jobs`
RLS policy on `auth.uid()` (Feature 04). Another user's id returns no row and becomes
the same `notFound()` as an unknown id. Both paths go through one call, so the responses
cannot differ.

*Alternative:* query by `id` alone and compare `user_id` in code. Rejected because it
reads another user's row into the server before discarding it.

### D2. Five components, mapped onto eight blocks

All five are Server Components, take props only, and fetch nothing.

| File | Renders | Props |
|---|---|---|
| `JobInfo.tsx` | header card (tile, `<h1>` title, company, score pill, View Job Post) and the four fact cards | `job`, `postingUrl` |
| `MatchScore.tsx` | AI Match Reasoning card and Required Skills card, with the snapshot caption | `job` |
| `JobDescription.tsx` | Job Description card and its preview note | `description`, `postingUrl` |
| `CompanyResearch.tsx` | Company Research card, with the empty state only | `company` |
| `JobActions.tsx` | Apply Now, or the "no application link" line | `company`, `postingUrl` |

`page.tsx` itself renders the Back to Jobs link, the load-failed card and the provider
attribution. These are page chrome, like the profile page's inline attention banner.
Local helpers (`MatchScoreBadge`, `FactCard`, `SkillPill`, `NotProvided`) stay unexported
inside the file that uses them, as in `JobsTable`.

### D3. One band rule for bar and pill

The band function moves from `JobsTable` to `lib/utils.ts`:
`scoreBand(score: number): "high" | "mid" | "low"`. It returns high at
`HIGH_MATCH_THRESHOLD` (70) and above, mid at 50 to 69, and low below 50. `JobsTable` maps
a band to its existing bar classes and `JobInfo` maps it to pill classes. One threshold
source means the two can never drift apart.

The pill is the badge shape (`rounded-full px-2 py-0.5 text-xs font-medium`, with
`inline-flex items-center gap-1.5`), holding an `aria-hidden` 6 px dot in the band's bar
colour (`bg-success` / `bg-warning` / `bg-text-muted`):

- **high:** `bg-success-lightest text-success-foreground`, as the design draws it;
- **mid and low:** `bg-surface-secondary text-text-dark`.

**Why the dot, not a coloured pill:** `text-warning` (#FF8904) on white is roughly 2.4:1,
below WCAG AA for 12 px text, and no darker warning token exists. The dot carries the band
and the text carries the value, so colour is never the only signal. Unscored: the same
neutral pill, no dot, reading "Not scored". Each state is a complete class string (the
Variant Class Standard), never an appended override.

### D4. The row link

In `JobsTable`, the `<tr>` gains `relative`. The **title** cell holds the row's only link:

```
<Link href={jobListHref(`/find-jobs/${job.id}`, params)}
      className="after:absolute after:inset-0 focus:outline-none
                 focus-visible:after:ring-1 focus-visible:after:ring-inset focus-visible:after:ring-accent">
  {title}<span className="sr-only"> at {company}</span>
</Link>
```

The `::after` box stretches the click target over the whole row. The ring draws on that
same box, so a keyboard user sees the whole row focused. There is one tab stop per row,
and the accessible name is "{role} at {company}". `params` is the server-clamped view
already passed in as a prop, so the link carries exactly what the user is looking at. A
null title links as "Untitled role".

*Alternatives:* (a) a click handler on `<tr>`. Rejected because it is not a link, so it
offers no keyboard access, no middle-click, and no "open in new tab". (b) A link in every
cell. Rejected because it gives six tab stops per row.

**Risk:** `position: relative` on a `<tr>` was historically unreliable. Task 5.3 clicks
a non-title cell (salary, date) and the empty row edge to prove the stretched target. If
it fails, the fallback is `relative` on each `<td>` with the link's `::after` scoped to
the title cell, plus `cursor-pointer` with no navigation on the others. That changes the
spec (whole-row click), so it would be raised before applying.

### D5. Back to Jobs and tamper safety

`backHref` comes from D1 step 1. The pathname is the constant `/find-jobs`, and
`jobListHref` writes only the four validated keys. So no query string can make the link
lead anywhere else, and junk values fall back to the defaults (spec: "A tampered view
falls back"). The link is `inline-flex items-center gap-1 text-sm font-medium
text-text-secondary hover:text-text-primary` with `ChevronLeft h-4 w-4`, as drawn.

### D6. External links

`safeExternalUrl(value: string | null): string | null` in `lib/utils.ts`. It trims the
value, then `new URL(value)` inside a `try`, and returns `url.href` only when `protocol` is
`http:` or `https:`. Anything else returns `null`: an empty string, a relative path,
`javascript:`, `data:`, or text that fails to parse.

React does not block `javascript:` hrefs. It only warns in development, so this check is
the guard.

Every external link has `target="_blank" rel="noopener noreferrer"`, an `ExternalLink`
icon (`aria-hidden`), and a `<span className="sr-only"> (opens in a new tab)</span>`.

- **View Job Post:** the secondary button classes plus `inline-flex items-center gap-2`.
- **Apply Now:** a full-width accent primary link,
  `flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm
  font-medium text-accent-foreground transition-opacity hover:opacity-90
  focus:outline-none focus:ring-1 focus:ring-accent`. It reads "Apply Now at {company}",
  or "Apply Now" when there is no company.
- **No `postingUrl`:** both links are absent, and `JobActions` renders
  `text-center text-sm text-text-muted` "No application link was provided for this job."
  instead.

### D7. Not found and load failure

- **`not-found.tsx`:** a Card (surface), centred inside the standard container and the
  `max-w-4xl` column. It shows `SearchX h-6 w-6 text-text-muted`, then the heading
  "Job not found" (`text-base font-semibold`), then the muted line "It may have been
  removed, or the link may be wrong.", then a secondary-button link "Back to Jobs" to
  plain `/find-jobs`. `not-found` receives no `searchParams`. The copy never says "not
  yours".
- **Load failed** (inline in `page.tsx`): the same card shape, with
  `CircleAlert h-6 w-6 text-error`, "Could not load this job. This is usually
  temporary." (the list's wording). It offers a secondary-button `<a href>` to the
  current address labelled "Try again", which is a real reload because the page has no
  client code. The way back is the page's own Back to Jobs link directly above the card.
  It is rendered in every state, so the card does not repeat it. (This was changed
  during apply; the first draft repeated it inside the card.)

### D8. Layout and fact cards

The page keeps the standard container `mx-auto max-w-[1440px] px-8 py-8`, wrapping
`mx-auto flex max-w-4xl flex-col gap-6` (the profile page's column). The design's content
width matches.

The header is a Card (surface) laid out `flex items-start justify-between gap-6`:

- a left group `flex items-start gap-4` holding a `flex h-14 w-14 shrink-0 items-center
  justify-center rounded-md border border-border bg-surface-secondary` tile with
  `Building2 h-6 w-6 text-text-muted`;
- the title `<h1 className="text-2xl font-semibold text-text-primary">`;
- below it, `flex flex-wrap items-center gap-2 text-sm text-text-secondary` with the
  company, an `aria-hidden` "•" and the pill.

Fact cards sit in `grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4`. Each is
`flex items-center gap-4` and uses the Card (surface) at `p-4`. **This is a third
documented padding override**, recorded by `/imprint`. Four `p-6` cards make the row
taller than the design for two lines of text. Each card has:

- an icon tile, `flex h-10 w-10 shrink-0 items-center justify-center rounded-md` plus a
  tint;
- a value in `truncate text-sm font-semibold text-text-primary` with
  `title={full value}`;
- a label in `text-xs font-medium uppercase tracking-wide text-text-muted`.

`truncate` hides overflow visually only, so the full text stays in the DOM for assistive
technology, and `title` shows it on hover.

| Fact | Icon | Tile | Value |
|---|---|---|---|
| SALARY EST. | `DollarSign` | `bg-success-lightest text-success` | `salary`, else not provided |
| LOCATION | `MapPin` | `bg-info-lightest text-info-foreground` | `location`, else not provided |
| JOB TYPE | `Briefcase` | `bg-accent-muted text-accent` | `job_type`, else not provided |
| DATE FOUND | `Calendar` | `bg-surface-secondary text-text-muted` | `<time dateTime={found_at}>{formatRelativeDate(found_at)}</time>` |

**Not provided** renders `<span aria-hidden="true">—</span><span className="sr-only">Not
provided</span>`, matching the design's em dash.

### D9. The match assessment

Both cards are Card (surface). Each one's header row is `flex items-center gap-3`:

- **Reasoning:** a `h-8 w-8 rounded-md bg-success-lightest` tile with
  `Sparkles h-4 w-4 text-success`, and a heading `<h2>` in the design's label style
  (`text-xs font-medium uppercase tracking-wide text-text-secondary`): "AI MATCH
  REASONING".
- **Skills:** heading "REQUIRED SKILLS VS YOUR PROFILE", followed by the snapshot caption
  in `mt-1 text-xs text-text-muted`: "Based on your profile when this job was found."

| State | Reasoning card | Skills card |
|---|---|---|
| scored, reason present | reason in `mt-4 text-sm leading-6 text-text-primary` | two labelled lists |
| scored, reason `''` or null | `mt-4 text-sm text-text-muted` "No reasoning was recorded for this match." | two labelled lists |
| unscored (`match_score` null) | muted "This job hasn't been scored yet. It will be scored the next time a search finds it." | muted "Skills are compared when the job is scored." |

The lists sit under `<h3 className="mt-4 text-xs text-text-muted">` "You have" and "Gap
skills". Each is a `<ul className="mt-2 flex flex-wrap gap-2">` of pills:

- **matched:** `inline-flex items-center gap-1 rounded-full bg-success-lightest px-2 py-0.5
  text-xs font-medium text-success-foreground` with `Check h-3 w-3`;
- **gap:** the same shape with `bg-accent-muted text-accent` and `X h-3 w-3`.

Icons are `aria-hidden`. The list headings name the lists, so colour is not the only
signal.

Empty lists show muted copy in place of the `<ul>`:
- "None of your profile skills were matched for this job."
- "No gaps were found."

The X is decorative, not a remove button. It is not focusable and has no handler, unlike
the profile's removable tag pill.

### D10. Description

The card header is `FileText` in a `bg-surface-secondary` tile, with
`<h2 className="text-base font-semibold">` "Job Description" as drawn.

- The body is `mt-4 whitespace-pre-line text-sm leading-6 text-text-primary`.
- A note follows in `mt-4 text-xs text-text-muted`: "This is a preview from the job
  provider." When `postingUrl` exists it continues with an external link (D6
  treatment, `text-accent hover:opacity-80` text link) reading "Read the full posting".
- A null or blank `about_role` shows muted "No description was provided for this job."
  with no preview note.

### D11. Company Research card

The header row is `flex items-center gap-3 border-b border-border pb-4`, with `Building2`
in a `bg-accent-muted text-accent` tile and an `<h2 className="text-base font-semibold">`
reading "Company Research".

The body is `py-12 text-center`:
- a `mx-auto h-12 w-12 rounded-md bg-surface-secondary` tile with
  `Building2 h-6 w-6 text-text-muted`;
- "No research yet" in `mt-4 text-sm font-medium text-text-primary`;
- "A research dossier on {company} will appear here." in
  `mt-1 text-sm text-text-muted`, with "this company" when the company is null.

There is no button and no "click" wording. It renders the same whatever
`company_research` holds, since this change never reads that column. Feature 13 replaces
the body.

### D12. Attribution and what is deliberately absent

`page.tsx` ends with `<p className="text-xs text-text-muted">Jobs by Adzuna</p>`, using
the existing **Provider attribution** pattern. It is not gated: every job is an Adzuna
job.

There is:
- no `"use client"` anywhere in `job-details/`;
- no analytics event;
- no `metadata` (no page in the app sets one);
- no `loading.tsx` (a skeleton would only delay a single-row read).

## Risks / Trade-offs

- **[Stretched-row link on `<tr>`]** → Task 5.3 proves it; D4 names the fallback.
- **[`z.uuid()` may reject a valid but unusual UUID]** → Every `jobs.id` is
  `gen_random_uuid()` (v4), which `z.uuid()` accepts. Task 5.2 opens a real id.
- **[The snapshot can look stale after a profile edit]** → It is captioned as a snapshot.
  This was agreed in `/architect` and is not re-filtered.
- **[A text-only empty state can feel unfinished next to the design's active button]** →
  Accepted. The alternative was a control that does nothing. Feature 13 fills it.
- **[The fact-card `p-4` override]** → It is recorded in the registry, so the next page
  does not treat it as drift.

## Migration Plan

None. There is no schema or config change. The new route serves nothing until a row links
to it. Rollback means reverting the commit; `JobsTable` returns to inert rows.
