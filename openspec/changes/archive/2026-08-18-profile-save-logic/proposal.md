## Why

The profile page is mock UI: Save does nothing, resume files never leave the browser, and the completion banner is hardcoded. Users cannot persist a profile, so later features (extract-from-resume, job matching) have no real data to read. Feature 05 shipped the layout; Feature 06 is the first write path.

## What Changes

- Add a `saveProfile` Server Action that upserts the signed-in user's `profiles` row (insert on first save, update after) and calls `revalidatePath('/profile')`.
- Allow incomplete saves. Persist `is_complete` only; compute completion percentage and missing-field tags at read time from a required-field list.
- Pre-fill the form from the saved row on return visits. First visit is empty except read-only email from the auth session. Drop Feature 05 mock field values.
- Map dropdown UI labels to schema enum values on save (and the reverse on pre-fill).
- Add `uploadResume` Server Action, fired when the user selects a valid PDF (type + 5MB, client and server). Persist returned `url` and `key`. Enforce `{user_id}/` path prefix on the server.
- **Schema:** add `profiles.resume_pdf_key` (text, nullable). Do not add columns for percentage or missing fields. Do not write `cover_letter_tone` from the UI.
- Fire PostHog `profile_completed` once, client-side, when `saveProfile` moves `is_complete` from false to true.

## Non-goals

- Extract from Resume (Feature 07) and Generate Resume from Profile (Feature 08) — Generate stays inert.
- `ResumePreview.tsx`, cover-letter tone UI, extracting `SelectField` / `TagInput` from `ProfileForm.tsx`.
- Multiple resume versions, `upsert: true` on storage upload, standing up `lib/posthog-server.ts`.
- Adding a test framework.

## Capabilities

### New Capabilities

- `profile`: Load, save, and complete a user's main profile; upload one active resume PDF; show real completion state on `/profile`.

### Modified Capabilities

- (none — `openspec/specs/` has no existing capabilities)

## Impact

- **App:** `actions/profile.ts` (new), `app/(app)/profile/page.tsx`, `components/profile/ProfileForm.tsx`, `components/profile/ResumeUpload.tsx`, `components/profile/CompletionIndicator.tsx` (props only). Shared completion helper under `lib/`. Profile types under `types/`.
- **Schema:** migration adding `resume_pdf_key` on `public.profiles`, applied via InsForge (same path as Feature 04). Human gate: confirm the column exists in the linked project before claiming end-to-end upload.
- **Storage:** existing private `resumes` bucket. Server-mediated path isolation. No new env vars.
- **Analytics:** first product event (`profile_completed`) on the existing client PostHog SDK.
- **Docs:** `context/progress-tracker.md` after ship; `context/library-docs.md` storage rules (drop stale `upsert: true` / `getPublicUrl`) as part of this change. `context/ui-registry.md` only if a new UI component is added (not expected).
- **Verification:** `npm run lint`, `npm run build`, manual click-through of `/profile`. No test runner.
