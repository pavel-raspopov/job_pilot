## 1. Extraction route

- [x] 1.0 **Blocking spike — settle design decision 11 before writing anything else.** With the dev server running and a signed-in session, call `insforge.ai.chat.completions.create` server-side with a one-word prompt and log only the HTTP status. If it succeeds, the user session token is accepted and no environment variable is needed. If it returns `AUTH_UNAUTHORIZED`, stop and tell the developer to fetch `OPENROUTER_API_KEY` from the InsForge dashboard (or run `npx @insforge/cli ai setup`); then add that one variable to `.env.local` and the `lib/env.ts` zod schema and read it server-side. Verify by the logged status. Never print or commit the key value.
- [x] 1.1 Create `app/api/resume/extract/route.ts` with a `POST` handler that authenticates via `createInsforgeServer()` + `auth.getCurrentUser()` and returns `{ success: false, error }` for a signed-out request. Verify by calling the route with no session cookie and getting a refusal, not a 500.
- [x] 1.2 Load the caller's `profiles` row, read `resume_pdf_key`, and re-apply the `keyBelongsToUser` first-segment check from `actions/profile.ts:160`. Return the no-resume error when the key is absent. Verify against a signed-in user with no resume on file.
- [x] 1.3 Mint a short-lived signed URL with `storage.from("resumes").createSignedUrl(key, <minutes>)` and return an error if it fails. Do not return the URL to the client. Verify by logging the response shape server-side only.
- [x] 1.4 Define the extraction tool schema (one function whose parameters cover every profile field, with `enum` on work authorization, experience level, remote preference, and degree) and export the model id as a single constant defaulting to `google/gemini-2.5-flash`.
- [x] 1.5 Write the prompt per design decision 10 — `YYYY-MM` dates, `currently_working` instead of an end date for present roles, at most 3 roles most recent first, omit unstated fields, and infer `experience_level` from titles and years when not stated.
- [x] 1.6 Call `insforge.ai.chat.completions.create` with the file part, `fileParser: { enabled: true }`, the tool, and `toolChoice: "required"`. Read the tool call off the SDK's normalized return value, and `JSON.parse` its `arguments` string inside a `try`/`catch`.
- [x] 1.7 Validate the parsed arguments with a zod schema built on the enum guards exported from `lib/profile-completion.ts`, dropping individual bad fields rather than rejecting the whole payload. Return the unreadable-resume error when every field drops out.
- [x] 1.8 Return `{ success, profile?, error? }`, logging real failures server-side with a `[api/resume/extract]` prefix and never leaking provider names, storage keys, or raw errors into `error`. Verify `npm run lint` passes.

## 2. Form wiring

- [x] 2.1 In `components/profile/ProfileForm.tsx`, add a `draft` state seeded from the `profile` prop and a `formKey` counter, and drive every `defaultValue` from `draft` instead of `profile`. Verify with `npm run build` and a click-through showing pre-fill still works for a saved profile (Feature 06 behavior unchanged).
- [x] 2.2 Change `ProfileForm`'s root to a fragment that renders `<ResumeUpload>` above the `<form>`, add a `hasResume` prop, and remove the direct `<ResumeUpload>` render from `app/(app)/profile/page.tsx`. Confirm in the browser that `ResumeUpload` is **not** inside the `<form>` element and that Save Profile still submits only profile fields.
- [x] 2.3 Add an `onExtracted` handler in `ProfileForm` that merges extracted values over the current draft (leaving unstated fields untouched), sets `skills` / `industries` / `roles` state directly, caps roles at 3, and bumps `formKey`. Verify extracted values appear in scalars, dropdowns, tags, and roles.

## 3. Extract control

- [x] 3.1 In `components/profile/ResumeUpload.tsx`, add an Extract from Resume button rendered only when a resume is on file, using the **secondary button** pattern from `context/ui-registry.md` with `type="button"`. Tokens only — no raw Tailwind colors or hex. Verify the control is absent for a profile with no resume.
- [x] 3.2 Wire the button to `POST /api/resume/extract`, disable it while in flight with pending copy on the label, and call `onExtracted` on success. Verify a second click cannot start a concurrent request.
- [x] 3.3 Render failures with the existing **Inline form error** pattern, reusing the component's `error` state. Verify the unreadable-resume message and confirm the form is unchanged after a failure.
- [x] 3.4 Confirm the "Generate Resume from Profile" CTA is still inert and unchanged — it belongs to Feature 08.

## 4. Documentation

- [x] 4.1 Update `context/architecture.md`: replace the OpenAI/GPT-4o entries for this path with the InsForge AI gateway, and note that `app/api/resume/extract/route.ts` now exists.
- [x] 4.2 Update `context/code-standards.md`: remove `OPENAI_API_KEY` from the environment table and drop `openai` / `pdf-parse` from the expected dependency list.
- [x] 4.3 Add an InsForge AI gateway section to `context/library-docs.md` covering the request shape, the `{ text, tool_calls, metadata }` raw response versus the SDK's normalized return, forced tool calls for structured output, and PDF file input.
- [x] 4.4 Run `/imprint` to record the Extract control and its pending state in `context/ui-registry.md`.
- [x] 4.5 Update `context/progress-tracker.md` — mark Feature 07 complete and record the gateway decision and the Extract-vs-Skip reconciliation from `proposal.md`.

## 5. Verification

- [x] 5.1 Run `npm run lint` and `npm run build` and show the output.
- [x] 5.2 Manual click-through: sign in, upload a **real** resume PDF (not only the synthetic fixture), click Extract, and confirm scalars, dropdowns, tags, and up to three roles populate correctly.
- [x] 5.3 Reload `/profile` without saving and confirm the form shows the previously stored values — proves extraction persisted nothing.
- [x] 5.4 Save after extraction, reload, and confirm the reviewed values stick and the completion banner recomputes.
- [x] 5.5 Exercise the failure paths: a profile with no resume on file, and a PDF with no readable content. Confirm each shows an error and leaves the form and stored data unchanged.
- [x] 5.6 Run `/verification-before-completion`, then `/feature-review`. Do not claim done without command output.
