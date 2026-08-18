# Memory — Feature 06 Profile Save Logic

Last updated: 8/18/2026, 9:18 PM

## What was built

- Feature 06 Profile Save Logic is implemented and archived. Change: `openspec/changes/archive/2026-08-18-profile-save-logic/`. Main spec: `openspec/specs/profile/spec.md` (7 requirements; `openspec validate --specs` passed).
- `actions/profile.ts`: `saveProfile` (session email, insert-or-update, enum allow-list, `is_complete` only) and `uploadResume` (PDF + 5MB, `resumes` bucket at `{userId}/resume.pdf`, persist returned url+key, no `upsert`).
- `lib/profile-completion.ts` (read-time % / missing tags / `isComplete`), `lib/parse-profile.ts`, `types/index.ts`. Migration `db/migrations/002_add_resume_pdf_key.sql` applied on InsForge and confirmed via table schema.
- `/profile` loads the real row, live completion banner, form pre-fill, client `profile_completed` once on false→true. Generate Resume stays inert. `next.config.ts` `serverActions.bodySizeLimit: "6mb"`.
- Imprint: inline form errors and inert primary CTA in `context/ui-registry.md`. `/impeccable document` skipped (no visual-system change).

## Decisions made

- Persist only `is_complete`; compute percentage and missing tags at read time. Never write `cover_letter_tone` from the profile UI.
- No `upsert: true` on storage; persist returned `url` + `key`; reject keys whose first segment is not `user.id`. `uploadResume` on file select; `saveProfile` writes form fields only.
- `SelectField` / `TagInput` stay private in `ProfileForm.tsx`. `ResumePreview.tsx` still deferred.
- Feature-review minors kept as-is: extra `parse-profile.ts` and `bodySizeLimit` are required, not bugs. Optional later: on-page save confirmation; reset the file input so re-picking the same PDF fires `onChange`.
- Node 26 `DEP0205` (`module.register()` → `registerHooks()`) is Next/Turbopack, not JobPilot. Do not patch `node_modules`. Do not pin Node unless asked. Warning is noise; `GET / 200` still works.

## Problems solved

- InsForge MCP was loading during apply; migration `002` was applied later via `run-raw-sql` and confirmed with `get-table-schema`. Private `resumes` bucket already existed.
- PostHog `profile_completed` was landing in the project whose token is in `.env.local`. The browser was signed into a different PostHog org/project, so Activity looked empty. Do not rotate keys or re-init PostHog. Authorized URLs can stay empty (warning only).

## Current state

- Product: Feature 06 done. Save, incomplete save, complete save + `profile_completed`, resume upload/replace, reload pre-fill, and banner hide at 100% were confirmed manually on `/profile`.
- No active OpenSpec changes. Next planned feature is 07 AI Profile Extraction from Resume.
- Repo-wide `npm run lint` still fails on pre-existing `.agents/` brainstorming `server.cjs`; Feature 06 source files lint clean. `npm run build` succeeded.

## Next session starts with

`/remember restore`, then `/opsx-propose` Feature 07 AI Profile Extraction from Resume. Do not re-open Feature 06 minors unless asked.

## Open questions

- Optional Feature 06 leftovers: save success copy; reset resume file input after upload.
- Feature 05 leftovers still not in scope: no remove-role control; extract `SelectField` / `TagInput` only when reused.
- Observation 5 OPEN: unquoted colons in `openspec/config.yaml` make the CLI ignore the file.
- Optional deferred: OAuth callback request-ID correlation (#8).
