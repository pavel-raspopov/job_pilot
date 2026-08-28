# Memory — Feature 07 AI Profile Extraction from Resume

Last updated: 8/28/2026

## What was built

Feature 07 shipped end to end. Change `add-resume-extraction` archived to `openspec/changes/archive/2026-08-28-add-resume-extraction/`; its 5 delta requirements merged into `openspec/specs/profile/spec.md` (now 12 requirements / 36 scenarios).

- **`app/api/resume/extract/route.ts`** (new) — authenticates the caller, reads `profiles.resume_pdf_key`, re-checks the user-id path prefix, mints a 5-minute signed storage URL, runs a readability probe, then extracts via a forced-schema tool call, validates with zod, and returns `{ success, profile?, error? }`. Writes nothing.
- **`components/profile/ProfileForm.tsx`** — now renders `ResumeUpload` (outside its `<form>`) and owns a `draft` state feeding every `defaultValue`, plus a `formKey` that remounts the form so uncontrolled inputs re-read the draft.
- **`components/profile/ResumeUpload.tsx`** — Extract from Resume button (secondary style, `Sparkles` icon, "Extracting…" pending state), shown only when a resume is on file.
- **`app/(app)/profile/page.tsx`** — no longer renders `ResumeUpload` directly.
- **`types/index.ts`** — gained `ExtractedProfile` and `ExtractActionResult`.
- Docs reconciled: `architecture.md`, `code-standards.md`, `library-docs.md` (new InsForge AI Gateway section), `ui-registry.md`, `progress-tracker.md`.

## Decisions made

- **All AI goes through the InsForge AI gateway** (`insforge.ai.chat.completions.create`), never OpenAI directly. No `OPENAI_API_KEY`, no `openai` package, no `pdf-parse`. Verified live: 531 models via OpenRouter, 133 file-capable. The anon key is accepted for chat completions (rejected for `/api/ai/models`), so **no new secret is needed**. This is the pattern for Features 08, 10, 13.
- **PDF sent natively** as a `file` part with `fileParser`, via a short-lived signed URL that never reaches the browser. A base64 data URI also works but inflates a 5MB PDF to ~6.7MB.
- **Two model constants, both benchmarked**: `EXTRACTION_MODEL` = `google/gemini-2.5-flash` (only candidate scoring 8/8 on ground-truth checks), `PROBE_MODEL` = `google/gemini-2.5-flash-lite`. **Do not downgrade extraction for cost** — flash-lite misspelled the surname and returned the wrong city; gpt-4o-mini dropped LinkedIn/degree/institution; gpt-5-nano never calls the tool. ~$0.0017 per extraction, ~580 on the free plan's $1/month.
- Single Extract action, no Skip button — Feature 06 already stores the resume on file-select, so Skip would do nothing. Reconciled against `project-overview.md`, which describes two options.
- No new PostHog event; the product event list stays at four.
- No new component files — `components/profile/` stays at the four names in `architecture.md`.

## Problems solved

- **The model fabricates a whole profile from an unreadable PDF.** With `toolChoice: "required"` a text-free PDF produced `full_name: "John Doe"`, San Francisco, generic skills — returned as *success*, filling the form with fake data a user could save. Prompt rules forbidding invention, a required `document_contains_resume` flag, and switching to `toolChoice: "auto"` all failed. **Fix: a readability probe — a separate call with no tool attached** that copies the document's first words or replies `EMPTY_DOCUMENT` (correct 10/10). With no schema to fill there is nothing to invent into. Guard now fails closed on three conditions: loose `/EMPTY[\W_]*DOC/i` match, a 20-char floor, and empty. This restores the guard `build-plan.md` specified for `pdf-parse`.
- **The SDK HTTP client times out at 30s**, shorter than a real extraction (20–40s). The AI call builds its own `createServerClient` with `timeout: 120_000`; session reads keep the default and `lib/insforge-server.ts` stayed frozen.
- **`export const maxDuration = 120` is mandatory on AI routes.** Without it the route inherits the serverless default (10s Vercel Hobby, 15s Pro) and dies in production while passing every local test, because dev has no limit. Every later AI route needs this.
- **Next.js treats `_`-prefixed folders as private** and excludes them from routing — `app/api/_spike/route.ts` 404s.
- The SDK normalizes gateway responses to OpenAI shape: read `choices[0].message.tool_calls`, **not** the raw HTTP `{ text, tool_calls, metadata }`.
- Tool-call `arguments` is a JSON **string**; parse in a `try`/`catch`. There is no `response_format` on the gateway, so forced tool calls are the only structured-output route.

## Current state

- `npm run lint`, `npm run build`, `npm run check:agents`, `npm run check:sync`, `openspec validate --specs --strict` all pass.
- Verified against the real CV: extraction, no-persist-until-save, save + banner recompute, no-resume path, unreadable path, signed-out refusal.
- `/feature-review` found 10 issues. Fixed: `maxDuration` (Critical), shared types moved out of the route, `EXTRACTION_MAX_TOKENS = 1536`, hardened fabrication guard, `??`→`||` in `toProfile`, logging on the unreadable path. Left open (Minor, in archived `design.md` decision 13): duplicated `fileName`/`resumeOnFile` state, HTTP 200 on all failures (deliberate), model variance, pre-existing Feature 08 stub copy.
- **Nothing is deployed.** `maxDuration = 120` must fit the hosting plan's ceiling — check before the first deploy.

## Next session starts with

`/remember restore`, then `/opsx-propose` Feature 08 Resume PDF Generation from Profile. It reuses this feature's gateway pattern plus `@react-pdf/renderer`, and finally activates the inert "Generate Resume from Profile" CTA.

## Open questions

- **Model variance on work history.** The same CV has yielded two identical roles, once read a client as an employer, and once returned `linkedin_url` as a bare domain. Review-before-save covers it; revisit if users complain.
- **Rotate the InsForge admin key?** It was once written in plaintext to `.mcp.json` by InsForge tooling. Never staged or committed, so not in git history — prudent, not urgent.
- Cline and Cursor are not installed on this machine; `.clinerules/` and `.cursor/` configs are written to convention and unverified.
- Feature 06 leftovers still open: save-success copy; reset the resume file input after upload; the skills/industries tag input does not clear after "Add".
- Optional deferred: OAuth callback request-ID correlation (#8).

## Testing notes

- CDP keystrokes do **not** update React state in this app's controlled inputs — drive them with the native value setter plus `input`/`change` events, or dispatch `.click()` on the element directly.
- The Browser pane scales an emulated viewport into a small area, so `ref`-based click coordinates can miss; clicking via JS is reliable.
- PostHog EU ingestion lags roughly a minute; an immediate query returning nothing is not evidence of failure.
- `assets/` holds a real CV used as the extraction fixture. It is **not committed** — it contains personal contact details.
