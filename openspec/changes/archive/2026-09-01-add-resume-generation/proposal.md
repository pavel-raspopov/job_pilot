# Generate a resume PDF from profile data

## Why

The Resume card has carried a disabled "Generate Resume from Profile" button since Feature 06. Everything behind it now exists: Feature 06 persists the profile, Feature 07 proved the InsForge AI gateway pattern, and `context/build-plan.md` Feature 08 is the last item in Phase 2.

The user-facing point is that a profile and a resume are the same facts in two shapes. A user who has filled in the profile — by hand or by extracting from an old CV — should not have to open a word processor to get a document they can send to an employer. `context/project-overview.md` frames the product as getting someone from sign-up to applying quickly; a resume they can download closes that loop.

## What Changes

- **New API route `app/api/resume/generate/route.ts`** — reads the signed-in user's saved profile, has the InsForge AI gateway rewrite it into resume prose (a professional summary and tightened responsibility bullets), renders a single-page PDF with `@react-pdf/renderer`, uploads the buffer to InsForge Storage, and returns a short-lived signed download URL.
- **New PDF document component** `app/api/resume/generate/resume-document.tsx`, colocated with the route because `context/library-docs.md` restricts PDF rendering to `app/api/resume/` and forbids importing the library from a client component.
- **The inert CTA becomes live.** "Generate Resume from Profile" gains a pending state, an inline error path, and a Download link on success. It stays disabled — with copy pointing at the attention banner — until the profile is complete.
- **New storage slot and two new columns.** The generated PDF is written to `resumes/{user_id}/generated-resume.pdf`, tracked by new `profiles.generated_resume_url` and `profiles.generated_resume_key`. The uploaded CV at `resumes/{user_id}/resume.pdf` and its `resume_pdf_url` / `resume_pdf_key` pointers are untouched.
- **One new dependency:** `@react-pdf/renderer` (^4.9.0, peer range covers React 19), plus a `serverExternalPackages` entry in `next.config.ts`.
- **Feature 07's private AI client factory moves to `lib/insforge-ai.ts`** so this route and Features 10 and 13 share one 120-second client instead of copying it. Behavior-neutral.

### Source reconciliation

Three sources disagree. Resolutions were put to the developer and approved before this proposal was written.

1. **Storage destination.** `context/build-plan.md` Feature 08 says to upload the generated buffer to `resumes/{user_id}/resume.pdf` with `upsert: true`, and `context/architecture.md`'s storage table lists exactly one path per user, described as "Current active resume PDF". But that object is the CV the user uploaded in Feature 06, and `resume_pdf_key` is the key Feature 07's extraction route reads. Following the build plan literally would delete the user's source document and make "Extract from Resume" re-extract the AI's own output.
   **Resolution (developer-approved):** a second slot, `resumes/{user_id}/generated-resume.pdf`, with its own `generated_resume_url` / `generated_resume_key` columns. `architecture.md`'s storage and `profiles` tables are updated to match, and `build-plan.md` gets a reconciliation note. Uploaded and generated resumes are different artifacts and are stored as such.

2. **Where the generated resume is shown.** `context/architecture.md` lists `components/profile/ResumePreview.tsx` in the component tree. It has never been built — Feature 06 deferred it explicitly, on the grounds that no feature yet displayed a stored resume. Feature 08 is the first that could justify it. `context/designs/profile.png` shows only the empty-state Resume card and is silent on a post-generation state, so there is no binding design.
   **Resolution (developer-approved):** no `ResumePreview.tsx`. The Download link lives in the Resume card's existing footer row, beside the button that produced it. `architecture.md` keeps the component listed as planned, with a note recording why it is still unbuilt.

3. **`resume_pdf_url` semantics.** `architecture.md` documents the column as "InsForge Storage URL of current resume", which once meant "the only resume". With two artifacts that wording is ambiguous.
   **Resolution:** `resume_pdf_url` / `resume_pdf_key` narrow to *the uploaded source resume*; the new pair covers *the generated resume*. The `resumes` bucket is private in both cases, so neither stored URL is directly fetchable — download always goes through a signed URL.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `profile`: adds resume-generation behavior — requesting generation, the completeness gate, the content the generated document must and must not contain, the non-destructive storage guarantee, download delivery, and the failure paths. Existing save, completion, upload, and extraction requirements are unchanged.

## Impact

**Code**

- New: `app/api/resume/generate/route.ts`, `app/api/resume/generate/resume-document.tsx`, `lib/insforge-ai.ts`, `db/migrations/003_add_generated_resume.sql`
- Modified: `components/profile/ResumeUpload.tsx` (live CTA, download link, `isProfileComplete` prop), `components/profile/ProfileForm.tsx` and `app/(app)/profile/page.tsx` (thread the new prop), `types/index.ts` (`Profile` columns + `GenerateActionResult`), `lib/parse-profile.ts` (parse the two columns), `app/api/resume/extract/route.ts` (import the moved AI client), `next.config.ts` (`serverExternalPackages`)
- Docs: `context/architecture.md`, `context/library-docs.md`, `context/build-plan.md`, `context/ui-registry.md`, `context/progress-tracker.md`

**Dependencies** — adds `@react-pdf/renderer` ^4.9.0. Nothing else; the AI call reuses the installed `@insforge/sdk`.

**Data** — migration `003` adds two nullable text columns to `profiles`. Existing RLS covers them; no policy change. No backfill — both columns are null until a user generates.

**Infrastructure (human gate)** — the InsForge MCP server failed to connect at planning time (`CONNECTION_CLOSED`), so `run-raw-sql` and `get-table-schema` are unavailable. The migration cannot be applied, and no end-to-end claim can be made, until either the MCP connection is restored or the SQL is applied through `npx @insforge/cli`. Task 1 settles this before any code depends on the columns.

**Secrets** — none added. Generation uses the same gateway credential path Feature 07 verified: the SDK's session-bearing client, no new environment variable.

**Credits** — one text-only completion per generation, cheaper than extraction's two calls (extraction pays for PDF parsing and a probe). Still charged against the free plan's $1/month. Cost is measured during implementation and recorded in a route comment, as Feature 07 did.

**Analytics** — none. `context/code-standards.md` fixes the product event list at four; no `resume_generated` event is added.

## Non-goals

- Job-tailored resumes. The generated document reflects the profile, not any particular listing. `context/architecture.md`'s `jobs` table has no tailored-resume columns and no feature in the 17-feature plan writes them.
- Cover letters, and the dormant `profiles.cover_letter_tone` column. Explicitly out of product scope.
- Template choice, theming, or any user-facing layout control. One layout.
- Resume version history. One generated artifact per user, overwritten on regenerate.
- `ResumePreview.tsx`, in-browser PDF preview, or thumbnails.
- Editing the generated prose before download. The user edits the profile and regenerates.
- Changing completion math, `is_complete`, the attention banner, or anything on the extraction path beyond the client-factory move.

## Verification

This repo has no test runner and none is added.

- `npm run lint`, `npm run build`, `npm run check:agents`, `npm run check:sync`, and `openspec validate --specs --strict`, with output shown.
- Manual click-through: with an incomplete profile the CTA is disabled and explains why; after completing and saving, Generate produces a downloadable one-page PDF whose name, title, contact line, roles, education, and skills match the saved profile.
- **Non-destructive check:** after generating, `resume_pdf_key` still points at `{user_id}/resume.pdf` and "Extract from Resume" still reads the uploaded CV. This is the regression the storage decision exists to prevent.
- Negative paths: signed out; no profile row; profile row present but incomplete.
- Timing: record wall-clock generation time against the route's `maxDuration = 120`.
