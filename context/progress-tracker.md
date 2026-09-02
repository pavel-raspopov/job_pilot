# Progress Tracker

Update this file after every completed feature. Any AI agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 3 — Find Jobs Page (in progress)
**Last completed:** 09 Find Jobs Page — Full UI
**Next:** 10 Adzuna Job Discovery

---

## Progress

### Phase 1 — Foundation

- [x] 01 Homepage
- [x] 02 Auth
- [x] 03 PostHog Initialization
- [x] 04 Database Schema

### Phase 2 — Profile Page

- [x] 05 Profile Page — Full UI
- [x] 06 Profile Save Logic
- [x] 07 AI Profile Extraction from Resume
- [x] 08 Resume PDF Generation from Profile

### Phase 3 — Find Jobs Page

- [x] 09 Find Jobs Page — Full UI
- [ ] 10 Adzuna Job Discovery
- [ ] 11 Filter + Sort + Pagination

### Phase 4 — Job Details Page

- [ ] 12 Job Details Page — Full UI
- [ ] 13 Company Research Agent

### Phase 5 — Dashboard

- [ ] 14 Dashboard Page — Full UI
- [ ] 15 Stats Bar — Real Data
- [ ] 16 Recent Activity — Real Data
- [ ] 17 Analytics Charts — PostHog Data

---

## Decisions Made During Build

- **Feature 09 Find Jobs Page — Full UI (2026-09-02).** `/find-jobs` now exists;
  the Navbar link had 404'd since Feature 01. Search controls, filter bar, a
  six-column table, and pagination over a 24-job mock array held in
  `app/(app)/find-jobs/page.tsx`. No Adzuna, no DB, no AI, no PostHog event, no
  new dependency, no migration. OpenSpec change `add-find-jobs-ui`.

  **Four source conflicts, all resolved before implementation.**

  1. **SOURCE column: build-plan wins over the design — a deliberate inversion.**
     `context/designs/find-jobs.png` draws five columns; `build-plan.md` Feature
     09 and `project-overview.md` both list a Search/URL badge. The project's
     default is that the design asset wins (that is why Feature 05 dropped the
     cover-letter-tone dropdown). The developer overrode the default here:
     `jobs.source` is a real migrated column with a documented badge token pair,
     Feature 10 writes `'search'` and a later URL-paste flow writes `'url'`, and
     the design simply predates the distinction. **Recorded because it inverts
     the usual precedence** — do not read it as drift.
  2. **Rows are hover-only, not links.** `project-overview.md` says a row click
     opens the job details page, but `/find-jobs/[id]` is Feature 12. Linking now
     would ship a known 404 — the project already carried one of those (the
     dashboard → `/profile` link, tech debt #10). Feature 12 adds the link when
     the destination exists.
  3. **Filter / sort / search / pagination are live client-side** over the mock
     array, per Feature 05's local-interactivity precedent, so Feature 11 is a
     data-source swap rather than building the behaviour from scratch. The rules
     are plain functions over an array for exactly that reason.
  4. **Score bars follow the tokens, not the design.** The PNG paints the 88%
     and 85% bars blue; the 2026-07-31 reconciliation (below) already settled
     this in favour of `ui-tokens.md`. Green from 70, orange 50–69, gray below
     50. **No blue appears in a score bar.**

  **The 70 boundary is one exported constant.** `HIGH_MATCH_THRESHOLD` in
  `lib/utils.ts` is read by both the High Match filter and the green score band —
  they are the same boundary, so a green bar is exactly a row that filter keeps.
  This is the Feature 08 rule applied preventively: last session's Critical bug
  was two derivations of one list disagreeing, and two `70` literals would have
  been free to drift the same way.

  **Three copy and count decisions where the design is internally inconsistent.**
  Its footer reads "Showing 1 to 6 of 24" beside page buttons numbered to 8, but
  24 items at 6 per page is 4 pages — so the page count is **derived** from the
  filtered total and renders 4. There is consequently no ellipsis: one button per
  page, because truncation logic could not be exercised at this scale and
  unverifiable code is worse than none. And the banner's "Found 8 jobs and saved
  4 strong matches" was copy written against an 8-row mock; the counts are now
  derived and passed in as props, so the summary cannot contradict the rows on
  screen. Feature 11 raises the page size to 20; Feature 10 reports the real
  run's counts.

  **`JobsTable` is the stateful container.** Filter, sort and pagination all read
  one derived list, so one component must own it, and `architecture.md` fixes
  this directory at four files — a fifth `JobsList.tsx` wrapper would contradict
  it. Recorded in `ui-registry.md` and `architecture.md` because the name
  undersells the role.

  **Placement details worth keeping.** `HIGH_MATCH_THRESHOLD` went into
  `lib/utils.ts`, not `types/index.ts`: that file is types-only and fully
  erasable, and a runtime value there would make every importer pull a runtime
  module. `page.tsx` is a plain (non-async) server component — it awaits nothing
  until Feature 10 reads `jobs`. Mock data lives in `page.tsx`, the first file
  Feature 10 opens, rather than a `lib/` module that would outlive its purpose by
  looking like infrastructure.

  Three new `ui-registry.md` patterns: **success banner** (the third variant
  beside neutral and error), **data table (jobs list)**, and **inline match score
  bar**, plus two documented Card padding overrides (`p-4` filter toolbar, and no
  card padding on the table card).

  **Adversarial `/feature-review` — 3 Minor findings, 2 fixed.** No Critical, no
  Important. Fixed: the row's `<th scope="row">` was computing `text-align:
  center` from the UA stylesheet, invisible only because a `display:flex` child
  filled the content box (`text-left` is now explicit); and the score bar was
  announced twice per row, once via `role="img"` and again by the adjacent
  visible percentage (the bar is now `aria-hidden`, so the text carries the
  value). **Deferred to Feature 10:** the empty state's copy assumes filters
  emptied the list, so a first-ever visit with zero jobs and no filters would
  read "no jobs match the current filters" with no Clear button — unreachable
  while the array is hardcoded. A comment marks the spot in `JobsTable.tsx`.

  Worth knowing when verifying UI in the Browser pane: **with an emulated
  viewport in a small pane, clicks land at the wrong coordinates** — one reported
  at x=1307 was delivered at x=5392, which reads exactly like a dead button.
  Reset viewport emulation before concluding a control is broken; a
  capture-phase click listener tells you which it is.

- **Phase 2 adversarial review — 11 findings, 10 fixed (2026-09-01).** A
  `/feature-review` pass over Features 05–08 as an adversarial reviewer (now the
  skill's default). Two findings were proven by compiling
  `resume-document.tsx` outside Next.js and rendering synthetic profiles, rather
  than argued from the source.

  **The generated resume printed one job's achievements under another employer.**
  `buildModelInput` indexed `profile.work_experience` unfiltered while the
  document rendered a *filtered* list and looked bullets up by the filtered
  index. Any dropped role — one with neither company nor job title, which
  `stripBlankRoles` still persists — shifted every later role's bullets by one.
  Demonstrated: with a ghost role first, bullets addressed to the real employer
  were discarded (output byte-identical to the no-prose baseline apart from the
  PDF `/ID`) and the ghost role's bullets were printed in its place. Fixed with
  one exported `renderableRoles(profile)` that both the route and the document
  derive from, so the mismatch is now unrepresentable. **Feature 13 note:** when
  a model's output is keyed by position into a list, exactly one function may
  compute that list.

  **The "single-page" PDF was two pages, and raising `MAX_BULLETS_PER_ROLE` from
  4 to 6 caused it.** Measured: 3 roles × 6 one-line bullets + 43 skills → 2
  pages; the same profile with 2 roles → 1 page. The fixture profile has 43
  skills and *two* roles, which is exactly why manual verification missed it.
  Fixed by construction rather than by picking a new constant:
  `renderResumePdf` now renders, counts pages from the PDF page tree, and steps
  down `PAGE_FIT_LADDER` until it fits. The ladder **tightens type before it
  drops a bullet** — a denser resume still says everything the candidate did.
  Its first rung is the previous behaviour, so anything that already fitted
  renders byte-identically. Verified 1 page at 3 roles × 6 wrapping bullets +
  100 skills, and verified that a profile which fits is not trimmed.

  **Extraction was destroying values the user had typed.** `handleExtracted`
  bumps `formKey` to remount the form; the 17 named inputs are uncontrolled, so
  their DOM values were discarded and re-seeded from stored data. Typing a phone
  number and then extracting a resume that states no phone silently erased it.
  `draftFromForm` now reads the live form back before merging. Separately,
  `ExtractedProfile.education` is a new `ExtractedEducation` whose unstated
  sub-fields are **absent** rather than `null`/`""`, merged per sub-field — a
  resume naming only an institution used to clear a stored degree, field and
  year, quietly turning a complete profile incomplete.

  **The in-flight ref guard was applied to one button out of four.** Extract,
  Save and drag-and-drop upload all still relied on `disabled`, which lands a
  render too late — the exact defect fixed for Generate. Extraction is the
  costlier one (probe + extraction = two gateway calls), and a double first-ever
  Save raced two inserts of the same primary key, reporting failure on a save
  that succeeded. All four now hold a `useRef`. **Rule for Features 10 and 13:
  every billed action needs a ref, not a `disabled` attribute.**

  Also: server-side PDF magic-byte check (`File.type` is a caller's claim, not a
  fact about the bytes); `saveProfile` no longer writes a null email over a
  stored one; the generate route calls `revalidatePath("/profile")` so the
  freshly written `generated_resume_key` is visible to the page; and the
  `OPENAI_API_KEY` snippets left live in `architecture.md` and
  `library-docs.md` — which contradict `code-standards.md` and were the next
  thing Feature 13 would have copied — are now placeholders under an explicit
  UNRESOLVED note.

  **Server-side rate limiting for AI routes (the eleventh finding).** The
  client's ref guards stop an accidental double click but not a `for` loop
  against the endpoint, and every gateway call is billed against a $1/month
  credit. New table `ai_usage` (migration `004`, **applied**) holds one row per
  billed call; `lib/ai-rate-limit.ts` holds the limits and both helpers. Not in
  process memory, deliberately — serverless instances share none, so an
  in-memory counter is per-instance and therefore not a limit.

  Design points worth keeping. **A log, not a counter per window:** append-only,
  so the check never read-modify-writes shared state, and it doubles as the cost
  telemetry Features 10 and 13 will want. **One round trip:** PostgREST returns
  an exact count alongside the rows, so `limit(1)` on an ascending order yields
  both "how many in the window" and "the oldest one in it" — and the oldest is
  what determines when a slot frees up. **RLS is select-own and insert-own with
  no update or delete policy** — a limit a user can clear is not a limit, and a
  user inserting spurious rows only lowers their own quota. **`route` has no
  CHECK constraint**, unlike the other enum-ish columns here, because otherwise
  every new AI route becomes a migration; the closed set is `AI_ROUTE` in
  TypeScript. **The check sits after the free failure cases** so a user with no
  resume still gets "upload a resume", not "too many requests". **Recorded
  before the call, not after**, because the cost lands whether or not the result
  is usable. **Fails open** if its own count query errors: a cost guard that
  takes the feature down when its bookkeeping hiccups is worse than one that
  occasionally lets a call through.

  Verified live against the real backend, one billed generation total: ten
  synthetic rows in the window → Generate refused in under 4s with "try again in
  about 47 minutes" and **no gateway call**; the pre-cleanup count was still
  exactly ten, proving a refused request does not count against the limit; after
  clearing, one real generation produced a **1-page** PDF, offered the signed
  download, and recorded exactly one row scoped to that user.

  `openspec/specs/profile/spec.md` gained an **AI request rate limiting**
  requirement. Note that it was edited directly rather than through a change
  under `openspec/changes/` — there was no active change to attach it to. Worth
  reconstructing as a retroactive change if the paper trail matters.

  **Retention is unhandled:** rows outlive their window and nothing prunes them
  (~240/user/day at the current limits). The cleanup statement is in the
  migration, waiting for a scheduled job.

- **Feature 08 Resume PDF Generation from Profile (2026-09-01).** `POST /api/resume/generate` reads the saved profile, has the InsForge AI gateway rewrite it into prose, renders a one-page PDF with `@react-pdf/renderer`, uploads it, and returns a 300s signed URL. Migration `003` adds `generated_resume_url` / `generated_resume_key`. Phase 2 is complete.

  **Two storage slots, not one — this is the load-bearing decision.** `build-plan.md` Feature 08 says to upsert the generated PDF over `resumes/{user_id}/resume.pdf`. That object is the CV the user uploaded in Feature 06, and its key is exactly what Feature 07's extraction reads, so following the plan would have deleted the user's source document and made "Extract from Resume" re-extract the model's own output, degrading further every round. Built instead: `generated-resume.pdf` alongside `resume.pdf`, each with its own url/key pair. Verified after 8 generations — `resume_pdf_key` and its url hash byte-identical, `resume.pdf` still carrying its original upload timestamp, and extraction still returning the *uploaded* CV's title ("Frontend / Full-Stack Engineer", which differs from the generated PDF's "Front-end Engineer" — proof it read the right file).

  **The model never sees the facts.** Rather than a prompt rule against inventing, the `record_resume` tool schema carries *prose only* — a summary and per-role bullets. Names, employers, titles, dates, degrees, and skills go from the profile row straight into the PDF, so there is no field the model can corrupt. Verified: every employer, year, and institution in the output appears in the stored profile. When the rewrite fails entirely (tested with a bogus model id) the PDF still renders from stored text and simply omits the summary — never a hole, never an invention.

  **Never trust a PDF that "looks fine" — decode it.** Five defects survived lint, build, and TypeScript, and were caught only by rendering the document and reading its text operators. (1) The built-in **Helvetica is WinAnsi-only**: it mangled Cyrillic into garbage bytes and silently dropped every `•` and `—`, so bullets were invisible for *all* users. Inter Regular/SemiBold are now bundled at `app/api/resume/generate/fonts/` and registered. (2) The name overlapped the title — baselines 6pt apart for a 22pt line; the page's `lineHeight` did not give it a tall enough box. (3) `letterSpacing` on section headings made each glyph its own positioned run, so extraction returned `S U M M A RY`; an ATS looks for `EXPERIENCE` and would have found noise. Removed. (4) A 43-skill list rendered with per-item separators spilled onto page 2. (5) A double click fired **two billed AI calls** — `setGenerating(true)` is async, so both clicks read `generating === false`; the `disabled` attribute alone is not a guard, a `useRef` is.

  **Model measured, not assumed.** `google/gemini-2.5-flash` at 779 in / 264 out ≈ **$0.00089** per generation (~1,100 on the free $1/month). `gemini-2.5-flash-lite` is ~5x cheaper and produced comparable bullets, but wrote the *current* job in the past tense — reads as though the candidate has left. Not worth the saving at this volume.

  **Two Next.js/SDK facts worth keeping.** `@react-pdf/renderer` needs **no** `serverExternalPackages` entry (already a Next.js default), but fonts read from disk **do** need `outputFileTracingIncludes` — nothing imports them, so the serverless bundle ships without them and fails only in production, the same trap `maxDuration` set in Feature 07. And `storage.upload()` takes `File | Blob`, not the `Buffer` that `renderToBuffer` returns; the `Uint8Array` copy is required because a Buffer may be backed by a SharedArrayBuffer and is not assignable to `BlobPart`.

  **UI.** The inert "Generate Resume from Profile" CTA is live, gated on the computed `getProfileCompletion(...).isComplete` (the same helper the attention banner uses, so gate and banner cannot disagree) rather than the persisted `is_complete` flag. Download is a short-lived signed link — the bucket is private and the stored url returns 401. No new component files; no new PostHog event. The **Inert primary CTA** pattern in `ui-registry.md` is retired: this was its only user, and a real `disabled` button is announced to assistive tech where a permanently-styled fake one is not.

- **Feature 07 AI Profile Extraction from Resume (2026-08-28).** Extraction runs through the **InsForge AI gateway** (`insforge.ai.chat.completions.create`), not OpenAI directly — no `OPENAI_API_KEY`, no `openai` package, no `pdf-parse`. The PDF is sent natively as a `file` part with `fileParser`, via a 5-minute signed storage URL that is never returned to the browser. `architecture.md`, `code-standards.md`, and `library-docs.md` were reconciled to match; the legacy OpenAI and pdf-parse sections are marked SUPERSEDED. Two model constants, both benchmarked rather than guessed: `EXTRACTION_MODEL` = `google/gemini-2.5-flash` (only candidate scoring 8/8 on ground-truth checks) and `PROBE_MODEL` = `google/gemini-2.5-flash-lite` at `maxTokens: 24`. Roughly **$0.0017 per extraction**, about 580 on the free plan's $1/month credit. **Do not downgrade the extraction model for cost** — `flash-lite` misspelled the surname and got the city wrong, `gpt-4o-mini` dropped LinkedIn/degree/institution, `gpt-5-nano` never calls the tool. Table in `context/library-docs.md`.

  **Extract vs. Skip reconciled.** `project-overview.md` describes two options on upload (Extract / Skip), `build-plan.md` describes one Extract button, and `designs/profile.png` shows only the empty state and is silent. Built a single Extract action: Feature 06 already stores the resume on file-select, so a Skip button would perform no action.

  **Two traps worth remembering.** (1) The SDK's HTTP client defaults to a **30s timeout**, which a real multi-page CV exceeds; the AI call constructs its own client at 120s while session reads keep the default. (2) **Never force a tool call on input the model may not be able to read.** With `toolChoice: "required"` a text-free PDF made the model fabricate a complete profile ("John Doe", San Francisco, generic skills) and return it as a success, filling the form with data a user could save. Prompt rules forbidding invention, a required `document_contains_resume` flag, and relaxing to `toolChoice: "auto"` all failed to stop it. Fixed with a **readability probe** — a separate call with no tool attached that copies the document's first words or replies `EMPTY_DOCUMENT`, correct 10/10 across blank and real CVs. This restores the guard `build-plan.md` originally specified for `pdf-parse`; only the mechanism changed.

  **`maxDuration` is mandatory on AI routes.** Extraction takes 20–40s; without `export const maxDuration = 120` the route inherits the serverless default (10s Vercel Hobby, 15s Pro) and dies in production while passing every local test, because dev has no limit. Every later AI route (Features 08, 10, 13) needs the same export. Also cap output with `maxTokens` — output is the dominant cost.

  **Shared route types live in `types/index.ts`.** `ExtractedProfile` / `ExtractActionResult` started out declared in the route and imported by components, which pointed `components/` → `app/api/` against `architecture.md`. Moved before the pattern could be copied by the next three AI features.

  **Form wiring — no new component files.** `ProfileForm` now renders `ResumeUpload` (outside its `<form>`) and owns a `draft` state; a `formKey` remount makes the ~20 uncontrolled `defaultValue` inputs re-read it, avoiding a risky controlled-input rewrite of Feature 06's verified save path. Extraction merges over the draft so fields the resume omits are not blanked, and persists nothing until Save Profile. No new PostHog event.

- **Feature 06 Profile Save Logic (2026-08-18).** Persist only `is_complete`; completion % and missing tags are computed at read time (`lib/profile-completion.ts`). Added `profiles.resume_pdf_key` (SQL in `db/migrations/002_add_resume_pdf_key.sql`), applied via InsForge MCP `run-raw-sql` and confirmed with `get-table-schema`. Private `resumes` bucket present. `uploadResume` on file select; `saveProfile` writes form fields only. `profile_completed` fires client-side once on false→true. No `upsert: true`; persist returned storage url+key; reject keys whose first segment is not `user.id`. Cover letter tone still unwritten. `SelectField`/`TagInput` remain private in `ProfileForm.tsx`. Server Action body limit raised to 6mb in `next.config.ts` so 5MB PDFs can reach the action. No new component files; `/imprint` recorded inline form errors and the inert Generate Resume CTA. `/impeccable document` skipped — no visual-system change.

- **Feature 05 Profile Page — "Cover Letter Tone" dropdown omitted (2026-07-31).** `build-plan.md` Feature 05 lists it under Job Preferences, but the binding design (`context/designs/profile.png`) omits it and cover-letter generation is explicitly out of product scope. User confirmed: design wins. The `profiles.cover_letter_tone` DB column stays; the UI never exposes it unless a cover-letter feature is scoped.
- **Feature 05 Profile Page — scope decisions.** Mock UI with local client-side interactivity only (skill/industry tags add-remove, up to 3 work-experience roles via "+ Add role", Currently-working checkbox disables End Date, resume dropzone shows the selected filename). No save/upload logic, no `profile_completed` event (both Feature 06). Email is the one real value — pre-filled read-only from the InsForge session in the server page. Attention banner (70% ring, PHONE/LOCATION/EDUCATION tags) is hardcoded mock; real completion math arrives with Feature 06. Banner markup lives in `app/(app)/profile/page.tsx` composing `CompletionIndicator` — architecture.md's component tree lists exactly `ProfileForm` / `ResumeUpload` / `ResumePreview` / `CompletionIndicator`, so no extra banner component was invented; `ResumePreview.tsx` is deferred until a feature displays an uploaded resume.

- **Match-score bar color thresholds reconciled (2026-07-31).** `ui-tokens.md` and `ui-rules.md` disagreed on fill ranges (90/70/50 vs 80/60 breakpoints). Resolved in favor of `ui-tokens.md` because its green-from-70 boundary matches the product's High Match filter (`match_score >= 70`, build-plan.md Feature 11). Canonical: green (#10B981) at 70–100, orange (#FF8904) at 50–69, gray (#99A1AF) below 50; blue never appears in score bars. `ui-rules.md` and root `DESIGN.md` updated to agree. Applies when Features 09–12 build the score bar.
- **Feature 04 Database Schema — "tailored fields" on `jobs` skipped.** `build-plan.md` Feature 04 mentions "tailored fields", but the `jobs` schema in `architecture.md` (the schema source of truth) has no such columns and no feature in the 17-feature plan ever writes tailored-resume or cover-letter data (the dashboard's tailoring chart and cover-letter stat are mock-only in Feature 14; Feature 15 replaces the cover-letter stat with "Jobs This Week"). Built exactly the `architecture.md` schema. If a tailoring feature is added later, add the columns then.
- **Feature 04 Database Schema — `user_id` FKs reference `auth.users(id)`, not `profiles(id)`.** A `profiles` row only exists after the user first saves their profile (Feature 06), so referencing `profiles` would block agent runs for users without a saved profile (or force a profile-creation trigger, out of scope for a schema-only feature). Since `profiles.id` = `auth.users.id`, the values are identical. `profiles.id` itself references `auth.users(id) ON DELETE CASCADE`.
- **Feature 04 Database Schema — implementation details.** Migration SQL committed at `db/migrations/001_initial_schema.sql` (source of truth), applied via InsForge MCP `run-raw-sql`. CHECK constraints on agent-written enum-ish columns (`agent_runs.status`, `jobs.source`, `jobs.match_score` 0–100, `agent_logs.level`); profiles dropdown fields stay free text (UI-constrained). RLS enabled on all four tables with per-operation policies on `auth.uid()` (no `TO` role clause — the `auth.uid()` check is the gate; anon matches nothing). `jobs.run_id` and `agent_logs.job_id` are nullable with `ON DELETE SET NULL`. Private `resumes` bucket created; per-user path scoping is mediated server-side (InsForge storage has no path-scoped policy surface). Verified: `get-table-schema` on all four tables, bucket in metadata, and a live negative RLS test (anon-key REST read returns `[]`, anon-key insert rejected with 42501). `ui-registry.md` untouched — no UI in this feature.

- **Feature 03 PostHog Initialization — scoped to init + identify + reset only.** A `/review` pass found the branch had drifted ahead of the plan: it added marketing-funnel events (`landing_cta_clicked` via a `components/CTALink.tsx` + `.posthog-events.json`) and bespoke auth capture events (`oauth_sign_in_started`, `sign_in_completed`, `sign_in_failed`, `sign_out`), none of which are in the approved event list in `code-standards.md`. Per "don't build ahead of the stage," all of these were removed. Feature 03 now contains exactly: client init (`instrumentation-client.ts`), client-side `identify` (`components/PostHogIdentify.tsx`, rendered in `app/(app)/layout.tsx`), and client-side `reset` on logout (new `components/layout/LogoutButton.tsx`). The four product events (`job_search_started`, `job_found`, `profile_completed`, `company_researched`) remain deferred to their owning features.
- **Context docs reconciled to the real init approach.** The PostHog sections of `library-docs.md` / `code-standards.md` / `architecture.md` were written for an older pattern (`lib/posthog-client.ts` + `initPostHog()` + `NEXT_PUBLIC_POSTHOG_KEY` + manual pageviews). Updated to match the actual, correct Next.js 15.3+ setup: init in root `instrumentation-client.ts`, env var `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `/ingest` reverse proxy in `next.config.ts`, and autocapture + automatic pageviews left ON. `lib/posthog-server.ts` is kept as initialized scaffolding for the future server-side events but is currently unused.
- **Homepage components consolidated to match architecture.md** — Testimonial.tsx and BottomCTA.tsx were originally built as separate components, but a review flagged that architecture.md only plans for `Hero.tsx`, `HowItWorks.tsx`, `Features.tsx` under `components/homepage/`. Merged the testimonial quote section and bottom gradient CTA banner into a single `HowItWorks.tsx` component (neither section is reused elsewhere on the site). `app/page.tsx` and `ui-registry.md` updated accordingly.
- **Button radius/padding standardized** — CTAButtons.tsx and Navbar.tsx's "Start for Free" button originally used `rounded-lg` / `px-6 py-2.5`, which drifted from the documented button token spec (`rounded-md`, `px-4 py-2` per ui-tokens.md and ui-rules.md). Fixed to match tokens exactly.
- **Removed Playfair Display font** — Testimonial quote (now inside HowItWorks.tsx) previously used `next/font/google` Playfair Display for stylistic emphasis. This violated the "Inter only" font invariant in ui-tokens.md. Replaced with Inter (project default) using `font-semibold italic` for visual distinction instead of a secondary typeface.
- **CTA auth-aware routing deferred** — build-plan.md specifies "Get Started"/"Start for Free" should route to `/dashboard` if authenticated, `/login` if not. This logic is intentionally deferred until Feature 02 Auth is built, since no auth state exists yet. All CTAs currently route to `/login` unconditionally. Must be revisited once auth is implemented.
- **Feature 02 Auth — post-review cleanup** — a 3-layer `/review` surfaced 16 issues on the initial auth build. Fixes applied before Feature 03:
  - **File layout aligned to architecture.md**: renamed `lib/insforge/client.ts` → `lib/insforge-client.ts` and `lib/insforge/server.ts` → `lib/insforge-server.ts`; moved `app/login/` → `app/(auth)/login/` and callback → `app/(auth)/callback/page.tsx`; removed dead `app/api/auth/callback|github|google/` folders.
  - **Server-action auth**: replaced form-action + separate route handlers with `actions/auth.ts` (`'use server'`) using `createAuthActions` + `skipBrowserRedirect: true`, returning `{success, url?, error?}` to the client for controlled redirect.
  - **OAuth callback fix**: previously used `createServerClient` (read-only cookies) so session cookies could never be written. Now uses `createAuthActions` (full `CookieStore`) inside the `(auth)/callback` server page, then `redirect('/dashboard')`; `NEXT_REDIRECT` errors are re-thrown so Next's redirect propagates.
  - **Middleware type safety**: removed all `any` and `@ts-ignore`; typed `CookieStore` with a single commented `as CookieStore` cast justified by the SDK's overloaded `set?/delete?` signatures that can't be satisfied by a single-signature arrow.
  - **Design-token compliance**: rewrote login page and dashboard to use only tokens (`bg-background`, `bg-surface`, `bg-surface-secondary`, `bg-overlay-dark`, `border-border`, `text-text-primary/secondary/muted`, `bg-accent`, `text-accent-foreground`, `focus:ring-accent`). No raw Tailwind color classes or hex values remain.
  - **Brand icons**: `lucide-react` has no GitHub/Google marks — inlined FontAwesome-style GitHub SVG (496×512) and multicolor Google SVG (24×24) directly in the login page.
  - **Navbar split**: `Navbar.tsx` is now an async server component that reads session via `createInsforgeServer()`; client-only active-link highlighting extracted to `components/layout/NavbarNav.tsx` (`usePathname`).
  - **CTA auth-aware routing implemented**: `CTAButtons.tsx` now switches destination based on server-side session, resolving the previously deferred item.
  - Middleware protects `/dashboard`, `/profile`, `/find-jobs`; dashboard's redundant server-side redirect removed.
- **Feature 02 Auth — round-2 review fixes** — a second `/review` pass surfaced 10 more issues after the initial cleanup. Fixed 7, deferred 3 to `memory.md`:
  - **#1** `context/architecture.md` "InsForge Client Pattern" updated to `@insforge/sdk/ssr` with `cookies: cookieStore` shape, plus a `createAuthActions` example for cookie-writing flows.
  - **#2** `lib/insforge-server.ts` gained a JSDoc warning that `createServerClient` is read-only; cookie-writing auth must use `createAuthActions` inline in a Server Action or Route Handler.
  - **#3** Layout consolidation via route group `app/(app)/` — shared `layout.tsx` renders Navbar + main + Footer around all authed pages; dashboard moved from `app/dashboard/` to `app/(app)/dashboard/`.
  - **#4** OAuth `redirectTo` is now server-pinned via `NEXT_PUBLIC_APP_URL` or `headers()` inside `signInWithOAuthAction`. Client no longer supplies a redirect URL.
  - **#5** Added `--shadow-card` elevation token in `app/globals.css` `@theme` (Tailwind v4). Login card + dashboard card use the generated `shadow-card` utility instead of duplicated inline `shadow-[...]`. Documented in `context/ui-tokens.md`.
  - **#6** `useSearchParams()` in the login page wrapped in `<Suspense>` — silences Next 15/16 warning.
  - **#7** Logout converted from `POST /api/auth/logout` route handler to `signOutAction` Server Action that calls `revalidatePath('/', 'layout')` before `redirect('/login')`. Fixes stale router cache after sign-out. Navbar uses `<form action={signOutAction}>`. `app/api/auth/` removed.
  - **Deferred (see `memory.md`):** #8 callback error observability / request-ID, #9 `lib/env.ts` zod validator to replace `!` assertions, #10 dashboard `/profile` link 404 (expected until Feature 05).

---

## Notes

_Add notes here as the build progresses — workarounds, patterns, anything that differs from the context files._

- **Tech debt #9 resolved (2026-07-26):** Added `lib/env.ts` — zod-validated env, exported as typed `env`. All InsForge env access refactored from `process.env.X!` to `env.X` across `lib/insforge-client.ts`, `lib/insforge-server.ts`, `actions/auth.ts`, `proxy.ts`, `app/(auth)/callback/route.ts`. Installed `zod ^4.4.3`. Canonical env pattern documented in `code-standards.md`. Tech debt #8 (callback request-ID) and #10 (`/profile` 404) reassessed and deferred/no-action — see `memory.md`.
