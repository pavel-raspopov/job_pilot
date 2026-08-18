## 1. Schema

- [x] 1.1 Add `db/migrations/002_add_resume_pdf_key.sql`: `alter table public.profiles add column if not exists resume_pdf_key text;`. Verify: file exists and SQL is additive only.
- [x] 1.2 **Human gate:** apply the migration to the linked InsForge project (`run-raw-sql` or insforge-cli, same path as Feature 04). Confirm `resume_pdf_key` via table schema. Do not print secrets. Leave this pending if the dashboard/MCP is unavailable; do not claim E2E upload until it is done.

## 2. Types and completion

- [x] 2.1 Create `types/index.ts` with `WorkExperienceRole`, `Education`, and `Profile` matching `design.md` (including optional `resume_pdf_key`). Verify: `npx tsc --noEmit` or `npm run build` later in §8.
- [x] 2.2 Create `lib/profile-completion.ts` with `getProfileCompletion` (required-field list, percentage, missing-field tags, `isComplete`). Work experience and education each count as one slot. Verify: helper is importable; no DB calls.

## 3. Server Actions

- [x] 3.1 Read the Next.js 16 Server Actions guide under `node_modules/next/dist/docs/` and the InsForge SDK storage + database sections before writing actions. Verify: notes match `{ data, error }` and array inserts.
- [x] 3.2 Add `saveProfile` in `actions/profile.ts`: session required, email from auth, select-then-insert-or-update, enum allow-list, strip blank roles, set `is_complete` from the helper, `revalidatePath('/profile')`, return `{ success, error?, completedNow? }`. Never write `cover_letter_tone`. Verify: `npm run lint`.
- [x] 3.3 Add `uploadResume` in `actions/profile.ts`: PDF + 5MB checks, upload to `resumes` at `{userId}/resume.pdf` without `upsert`, reject returned keys whose first segment is not `user.id`, persist `url` + `key`, stub or update the profile row, remove previous key if it differs (log and continue on delete failure), `revalidatePath('/profile')`. Verify: `npm run lint`.

## 4. Profile page

- [x] 4.1 Update `app/(app)/profile/page.tsx` to load `profiles` for the current user, compute completion, hide the attention banner when there are no missing required fields, and pass `profile`, `email`, and `userId` into the form/upload. Stop hardcoding 70% / Phone / Location / Education. Verify: first visit (no row) shows email only; signed-out users still hit existing `/profile` protection.

## 5. Profile form

- [x] 5.1 Wire `components/profile/ProfileForm.tsx`: remove mock defaults; pre-fill from `profile`; blank select option when unset; submit via `saveProfile`; show returned errors; `option value`s are schema enums or mapped on the server. Keep `SelectField` / `TagInput` private. Verify: manual `/profile` — empty first visit, Save persists, reload shows values.
- [x] 5.2 On `completedNow`, `posthog.capture('profile_completed', { userId })` in the form. Do not use `lib/posthog-server.ts`. Verify: incomplete save does not capture; first complete save does.

## 6. Resume upload UI

- [x] 6.1 Wire `components/profile/ResumeUpload.tsx`: PDF type + 5MB on picker and drop; call `uploadResume` on valid select; show errors; show on-file state from `resume_pdf_key` / url after reload. Generate Resume stays a non-submitting inert button. Verify: manual `/profile` — valid PDF uploads without Save; invalid file does not; reload still shows a resume on file.

## 7. Docs

- [x] 7.1 Update `context/library-docs.md` Storage: persist returned `url` and `key`, no `upsert: true`, no `getPublicUrl` as the write path. Verify: grep `library-docs.md` has no `upsert: true` under Storage.
- [x] 7.2 Add `resume_pdf_key` to the `profiles` table in `context/architecture.md`. Verify: architecture table matches the migration.
- [x] 7.3 After verify passes, update `context/progress-tracker.md` (Feature 06 done, next Feature 07, record decisions). Skip `/imprint` unless a new component file was added.

## 8. Verify

- [x] 8.1 Run `npm run lint` and show the output.
- [x] 8.2 Run `npm run build` and show the output.
- [x] 8.3 Manual click-through of `/profile`: empty first visit, incomplete save, complete save + `profile_completed`, resume upload/replace, reload pre-fill, banner hide at 100%. Env names only (`NEXT_PUBLIC_INSFORGE_URL`, `NEXT_PUBLIC_INSFORGE_ANON_KEY`); no E2E claim if 1.2 is still pending.
- [x] 8.4 Run `/feature-review` before archive. Do not start Feature 07 in this change.
