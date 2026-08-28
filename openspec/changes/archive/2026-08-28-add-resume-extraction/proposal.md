# Extract profile data from an uploaded resume

## Why

Feature 06 lets a user upload a resume, but the profile form still has to be filled in by hand — roughly 20 fields, three work-experience roles, and four dropdowns. Every fact the form asks for is already in the PDF the user just uploaded. Re-typing it is the single largest source of friction before a user can start finding jobs, and `context/project-overview.md` sets the target at "sign up, fill profile, upload resume, and start finding jobs in under 5 minutes".

This change reads the stored resume and pre-fills the form, leaving the user to review and correct rather than transcribe.

## What Changes

- **New API route `app/api/resume/extract/route.ts`** — reads the signed-in user's stored resume from InsForge Storage, sends the PDF to the InsForge AI gateway, and returns validated profile fields as JSON. Writes nothing.
- **New "Extract from Resume" action** on the Resume card, visible only when a resume is on file, with a pending state and inline errors.
- **`ProfileForm` accepts extracted values** and repopulates every field — scalars, dropdowns, skill/industry tags, and up to three work-experience roles.
- **`ResumeUpload` moves from a sibling of `ProfileForm` to a child of it**, so one component owns the form state the extraction feeds.
- **No new dependencies and no new secrets.** The installed `@insforge/sdk` already exposes the AI gateway.

### Source reconciliation

Three project sources disagree; resolutions below are recorded rather than silently applied.

1. **Provider.** `context/build-plan.md` (Feature 07), `context/architecture.md`, and `context/code-standards.md` all specify OpenAI GPT-4o called directly with an `OPENAI_API_KEY`, plus a `pdf-parse` step to turn the PDF into text. The project has no such key, and `AGENTS.md` names InsForge as the backend. The installed SDK's `client.ai.chat.completions.create` brokers 531 models — including `openai/gpt-4o` — and accepts a PDF directly, making `pdf-parse` unnecessary.
   **Resolution (developer-approved):** use the InsForge AI gateway with native PDF input. `architecture.md` and `code-standards.md` are updated to match; the `OPENAI_API_KEY` row is removed from the env table. This sets the pattern for Features 08, 10, and 13.

2. **Extract vs. Skip.** `context/project-overview.md` (line 62) describes "two options on upload: Extract from Resume / Skip". `build-plan.md` Feature 07 describes a single Extract button that appears after upload. `context/designs/profile.png` shows only the empty-state Resume card and is silent on the post-upload state.
   **Resolution:** build a single Extract action, no Skip control. Feature 06 already stores the resume on file-select, so "Skip" is the user not clicking Extract — a Skip button would perform no action. Both sources produce the same user-visible outcome.

3. **Text-extraction failure copy.** `build-plan.md` specifies the error "Could not extract text from this PDF. Please try a different file." tied to the `pdf-parse` empty-text check. With no local text extraction that exact trigger no longer exists.
   **Resolution:** keep equivalent user-facing copy, triggered when the model returns no usable fields instead of when local text extraction comes back short.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `profile`: adds resume-extraction behavior — requesting extraction, mapping extracted values to schema values, the review-before-save guarantee, and the failure paths. Existing save, completion, and upload requirements are unchanged.

## Impact

**Code**

- New: `app/api/resume/extract/route.ts`
- Modified: `components/profile/ProfileForm.tsx` (owns draft state, renders `ResumeUpload`), `components/profile/ResumeUpload.tsx` (Extract action + `onExtracted` callback), `app/(app)/profile/page.tsx` (stops rendering `ResumeUpload` directly)
- Docs: `context/architecture.md`, `context/code-standards.md`, `context/library-docs.md` (InsForge AI gateway section), `context/ui-registry.md`, `context/progress-tracker.md`

**Dependencies** — none added. No `openai`, no `pdf-parse`, no `@react-pdf/renderer` (Feature 08).

**Data** — none. No schema change, no migration, and extraction never writes to `profiles` or Storage.

**Secrets (human gate)** — **unresolved, see design.md decision 11.** The intended path adds no environment variable: the SDK sends `Authorization: Bearer <user session token>`, and if the gateway accepts an end-user JWT nothing is needed. This is verified for an admin key but **not** for a user token, and the project anon key is known to be rejected. If user tokens are refused, the route needs a server-side credential (`OPENROUTER_API_KEY` from the InsForge dashboard, or `npx @insforge/cli ai setup`) added to `.env.local` and `lib/env.ts`. Task 1.0 settles this before anything else is built.

**Credits** — the InsForge free plan includes $1/month in AI model credits, refreshed monthly. At roughly $0.0008 per extraction that is about 1,250 extractions per month, so the free tier is sufficient. Balance is a dashboard concern; if credits are exhausted the route returns an error and extraction is unavailable, and end-to-end success cannot be claimed while unfunded.

**Analytics** — none. `context/code-standards.md` fixes the product event list at four (`job_search_started`, `job_found`, `profile_completed`, `company_researched`); no `resume_extracted` event is added.

## Non-goals

- Resume PDF **generation** from profile data — that is Feature 08. The "Generate Resume from Profile" CTA stays inert.
- Persisting extracted data automatically. Extraction only fills the form; the user saves.
- Storing extraction history, raw resume text, or multiple resume versions. One active resume per user stands.
- Changing completion math, `is_complete`, or the attention banner.
- Streaming or progressive field population.
- Any change to job matching, Adzuna, or company research, even though they will later use the same gateway.

## Verification

This repo has no test runner and none is added.

- `npm run lint` and `npm run build`, with output shown.
- Manual click-through: sign in, upload a real PDF resume, click Extract, confirm scalars, dropdowns, tags, and roles all populate.
- Reload without saving — the form must show the previously stored values, proving extraction persisted nothing.
- Save, then reload — extracted values stick and the banner recomputes.
- Negative paths: no resume on file; a PDF with no readable content.
