# Memory — Feature 08 Resume PDF Generation from Profile

Last updated: 9/1/2026

## What was built

Feature 08 shipped end to end. **Phase 2 is complete.** Change `add-resume-generation` archived to `openspec/changes/archive/2026-09-01-add-resume-generation/`; its 5 added + 1 modified requirements merged into `openspec/specs/profile/spec.md` (now 17 requirements).

- **`app/api/resume/generate/route.ts`** (new) — `POST` authenticates, loads the profile, refuses unless `getProfileCompletion(...).isComplete`, has the gateway rewrite prose, renders a PDF, uploads it, persists the pointer, and returns a 300s signed URL. `GET` returns a fresh signed URL for an already-generated resume without regenerating. `maxDuration = 120`.
- **`app/api/resume/generate/resume-document.tsx`** (new) — the PDF layout plus `renderResumePdf()`. JSX lives here because Next documents route handlers as `route.ts` only.
- **`app/api/resume/generate/fonts/`** (new) — Inter Regular + SemiBold TTFs, ~635KB, SIL OFL.
- **`lib/insforge-ai.ts`** (new) — `createAiClient()` / `AI_TIMEOUT_MS` lifted out of the extract route; Features 10 and 13 should import it.
- **`db/migrations/003_add_generated_resume.sql`** (new, **applied**) — `generated_resume_url` / `generated_resume_key` on `profiles`.
- **Modified:** `ResumeUpload.tsx` (live CTA, download link, existing-resume fetch on mount), `ProfileForm.tsx` + `profile/page.tsx` (two new props), `types/index.ts`, `lib/parse-profile.ts`, `extract/route.ts` (import swap), `next.config.ts` (`outputFileTracingIncludes`).
- **`AGENTS.md` merged and repaired** — see below.

## Decisions made

- **Two storage slots, not one.** `build-plan.md` said to upsert the generated PDF over `resumes/{uid}/resume.pdf`. That is the uploaded CV, and its key is what Feature 07's extraction reads — following the plan would have destroyed the source document and made extraction re-read the model's own output. Generated output goes to `generated-resume.pdf` with its own column pair. Verified non-destructive over ~12 generations.
- **The model never sees the facts.** The `record_resume` tool schema carries *prose only* (summary + per-role bullets). Names, employers, titles, dates, degrees, and skills go from the row straight into the PDF. Structural, not a prompt rule — there is no field the model can corrupt. Reuse this shape for Features 10 and 13.
- **`google/gemini-2.5-flash`**, 779 in / 264 out ≈ **$0.00089** per generation. `flash-lite` is 5x cheaper and comparable, but wrote a current job in past tense. Measurements are in a route comment.
- **Gate on the computed `getProfileCompletion(...).isComplete`**, not the persisted `is_complete` flag, so the button and the attention banner cannot disagree.
- No `ResumePreview.tsx`, no new component files, no new PostHog event (still four).

## Problems solved

- **Never trust a PDF that "looks fine" — decode it.** Twelve defects survived lint, build, and TypeScript. The worst: `@react-pdf/renderer`'s built-in **Helvetica is WinAnsi-only** — it mangled Cyrillic into garbage bytes and silently dropped every `•` and `—`, so bullets were invisible for *all* users. Bundled Inter fixes it; text extraction is now character-perfect, which matters because ATS systems parse resumes as text.
- **`letterSpacing` destroys machine-readability.** It made each glyph its own positioned run, so extraction returned `S U M M A RY`. Removed — a resume that reads well to a human and parses as noise to a recruiter's software has failed.
- **A `disabled` attribute is not an in-flight guard.** `setGenerating(true)` is async, so a double click fired **two billed AI calls**. Needs a `useRef`.
- **Capping bullets after splitting destroys content.** The cap was moved after the sentence-splitter to stop page overflow, which then shredded four rich bullets into six fragments and trimmed back to four — losing the tail of the last real one. Splitting is now a rescue for one case only (a single long blob). The cap itself (was 4) was also dropping a real achievement; now 6.
- **Two Next.js/SDK facts.** `@react-pdf/renderer` needs **no** `serverExternalPackages` entry (already a default), but fonts read from disk **do** need `outputFileTracingIncludes` or they ship missing and fail only in production. `storage.upload()` takes `File | Blob`, not the `Buffer` `renderToBuffer` returns — the `Uint8Array` copy is required because a Buffer may be backed by a SharedArrayBuffer.
- **When the InsForge MCP fails to connect**, the server itself is usually fine — the session just started before the config was fixed, and MCP connects at session start. `scratchpad/mcp-call.mjs` drives it over stdio using the exact command/env from `.mcp.json`, which unblocked the migration without a restart. Worth rebuilding if it happens again.
- **`.mcp.json` is now clean** — both values are `${INSFORGE_API_KEY}` / `${INSFORGE_API_BASE_URL}`, defined in `.claude/settings.local.json`. `check:agents` passes.

## Current state

- `npm run lint`, `build`, `check:agents`, `check:sync`, and both `openspec validate --strict` runs all pass. **`check:agents` is green for the first time in several sessions.**
- **Everything is uncommitted.** Nothing is deployed.
- Verified live against the real backend and profile: happy path, non-invention, non-destructive guarantee, extraction still reading the uploaded CV, regenerate-replaces, private-bucket 401, signed-out refusal, rewrite-failure fallback, double-click guard, reload re-offering an existing resume with no new AI call, and upload-leaves-generated-alone. Generation takes ~4–11s against the 120s budget.
- The gate tests (incomplete profile / no profile row) were verified by **temporarily inverting the branch in code**, not with real incomplete data — the permission classifier refuses `UPDATE` on `profiles`, and a form save would have rewritten 43 skills and two long role descriptions to test three lines. Branch tests, not end-to-end.
- A dev server may still be running on port 3000 (`preview_start` with `jobpilot-dev`).

## Next session starts with

Commit this work (`memory.md` staged with it), then `/opsx-propose` **Feature 09 Find Jobs Page — Full UI**, the first item in Phase 3. It is a mock-data UI feature, so `/impeccable shape` may be worth running if any visual decision is open; the binding design is `context/designs/`.

Before committing, check `.mcp.json` — it is modified, but that is the developer's own credential fix, not part of Feature 08.

## Open questions

- **Extraction gets work-history dates wrong often enough to matter.** Feature 07 produced two roles with the *same* start date (`2021-11`); the generated resume rendered it faithfully and the developer caught it by reading the document. Corrected to `2022-09` in the profile. This is the second recorded instance of work-history variance — review-before-save is load-bearing, not a nicety. Worth a guard if it recurs.
- `maxDuration = 120` must fit the hosting plan's ceiling — still unverified, nothing deployed.
- Feature 06 leftovers still open: save-success copy, resume file input not resetting after upload, skills/industries tag input not clearing after "Add".
- Cline and Cursor are not installed on this machine; those config trees are written to convention and unverified.
- Optional deferred: OAuth callback request-ID correlation (#8).

## Testing notes

- `assets/CV Pavel Raspopau ….pdf` (121,878 bytes) is the extraction fixture and matches what is in storage. **Not committed** — it holds real contact details. If a test overwrites the stored resume, restore from here.
- Driving the PDF from the browser is the only reliable way to inspect it: `fetch` the signed URL, then `pdfjs-dist` from a CDN for `getTextContent()` (what an ATS sees) and canvas render (what a human sees). `pdftoppm` is not installed and the Browser pane will not render a PDF navigation.
- Do **not** clear `document.body` while React is mounted — it throws `removeChild` errors that look like product bugs.
- CDP keystrokes do not update React state here; use the native value setter plus `input`/`change` events, or `.click()` directly.
