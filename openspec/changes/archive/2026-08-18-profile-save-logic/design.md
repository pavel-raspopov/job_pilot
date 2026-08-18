## Context

See `proposal.md` for motivation. Feature 05 left `/profile` as mock UI: `ProfileForm` swallows submit, `ResumeUpload` keeps the file in component state, and the attention banner is hardcoded (70%, Phone/Location/Education). Email is the only live value (`createInsforgeServer` + `auth.getCurrentUser()`).

Constraints that shape the approach:

- Mutations go through `actions/` Server Actions (`code-standards.md`). Components do not call InsForge.
- `profiles` rows are created on first save (Feature 04). `id` = `auth.users.id`. RLS already scopes to `auth.uid()`.
- Schema has `is_complete` and `resume_pdf_url` only; no percentage / missing-fields columns.
- InsForge Storage SDK returns `{ url, key }` and needs both for later download/delete. Feature 04: path isolation is server-mediated (bucket is private; no path-scoped policy surface).
- Product scope: one active resume per user. Cover letter generation is out of scope; `cover_letter_tone` stays unused.
- PostHog product events are client-side today (`posthog-js` identify/reset). `lib/posthog-server.ts` is unused scaffolding.
- No test runner: lint, build, manual `/profile` click-through.

## Goals / Non-Goals

**Goals:**

- Wire save + resume upload through Server Actions with `{ success, error? }` returns and `revalidatePath('/profile')`.
- Keep completion math in one pure helper used by the save path (for `is_complete`) and the profile page (for the banner).
- Add `resume_pdf_key` without otherwise changing the Feature 04 schema.
- Leave Generate Resume inert; leave Extract for Feature 07.

**Non-Goals (design-level):**

- New visual components or `/impeccable shape` (existing Feature 05 UI; hide the banner when complete).
- Extracting `SelectField` / `TagInput` from `ProfileForm.tsx`.
- Browser-direct storage uploads via `createBrowserClient`.
- Standing up server-side PostHog.

## In-scope / frozen files

**In scope:**

- `db/migrations/002_add_resume_pdf_key.sql` (new) + apply to the linked InsForge project
- `actions/profile.ts` (new)
- `lib/profile-completion.ts` (new)
- `types/index.ts` (new — architecture's types home; first real types)
- `app/(app)/profile/page.tsx`
- `components/profile/ProfileForm.tsx`
- `components/profile/ResumeUpload.tsx`
- `context/library-docs.md` (storage rules: persist returned url/key, no `upsert: true`)
- `context/progress-tracker.md` (on ship)
- `context/architecture.md` (`resume_pdf_key` on `profiles`)

**Frozen** (one-line type/compile fix only if a named verify command fails):

- `actions/auth.ts`, `lib/insforge-server.ts`, `lib/insforge-client.ts`, `proxy.ts`, `instrumentation-client.ts`, homepage/dashboard/layout/auth pages, `components/profile/CompletionIndicator.tsx` (keep percentage prop; page stops passing the mock `70`)

## Decisions

### 1. Compute completion at read; persist only `is_complete`

**Choice:** Pure helper `getProfileCompletion(profile)` returns `{ isComplete, percentage, missingFields }`. `saveProfile` writes `is_complete` from that helper. The page computes percentage/tags for the banner. No new columns.

**Why:** Schema is the column source of truth (same pattern as Feature 04 skipping “tailored fields”). Derived values would drift.

**Alternative considered:** Migrate `completion_percent` + `missing_fields` as the build-plan bullet says. Rejected — stale plan vs live schema.

Required-field list lives in the helper (single source). Percentage = `round(100 * filledRequired / requiredCount)` with requiredCount fixed by that list (work experience counts as one required slot: at least one complete role; education counts as one slot when all four education parts are present). Missing tags use the banner labels already used in Feature 05 (Phone, Location, Education, …).

### 2. Add `resume_pdf_key`; persist SDK `url` and `key`

**Choice:** `alter table public.profiles add column resume_pdf_key text;`. `uploadResume` uploads via `insforge.storage.from('resumes').upload(\`${userId}/resume.pdf\`, buffer, { contentType })` without `upsert: true`, then writes `data.url` → `resume_pdf_url` and `data.key` → `resume_pdf_key`. Prefix is always `user.id`. If a previous key exists and differs, `remove(oldKey)` after the new upload succeeds; log and continue if delete fails.

**Why:** InsForge SDK requires the key for download/delete (Feature 07/08). Guessing `{userId}/resume.pdf` breaks if the SDK returns a different key.

**Alternative considered:** URL-only and a derived path. Rejected — SDK contract and last-session decision to persist returned key/url.

Profile row may not exist yet on first upload: insert a stub row (`id`, `email`, resume columns, `is_complete: false`) or update if present. Same upsert-by-select pattern as save.

### 3. Two Server Actions, not one

**Choice:** `saveProfile(formData)` for fields; `uploadResume(formData)` for the PDF, called from `ResumeUpload` on a valid selection. Save does not accept a file.

**Why:** Feature 07 needs a stored PDF before the user saves extracted fields.

**Alternative considered:** Multipart save. Rejected — Extract would have nothing to read.

Use `createInsforgeServer()` in both (cookie JWT, RLS). Inserts are arrays. Returns `{ data, error }`. Never throw; return `{ success: false, error }`. `saveProfile` also returns `{ completedNow?: boolean }` for the client event.

Auth: if `getCurrentUser()` has no user, return an error (middleware already redirects `/profile`, but the action must not write as anon).

### 4. Select-then-insert-or-update (no SDK upsert)

**Choice:** Load `profiles` by `id = user.id`. Insert `[{ ... }]` if missing; otherwise `.update(...).eq('id', user.id)`. Set `updated_at` in the action.

**Why:** App-level upsert was the Feature 04 contract. The SDK’s documented upsert is a bulk admin HTTP API, not the row client.

### 5. Client PostHog on `completedNow`

**Choice:** `ProfileForm` calls `posthog.capture('profile_completed', { userId })` when the action returns `completedNow: true`. `userId` comes from a server-passed prop (page already has the session).

**Why:** Matches Feature 03. Do not initialize server PostHog for one event.

**Alternative considered:** `lib/posthog-server.ts` inside the action. Rejected as extra surface for this feature.

### 6. Empty first visit; map enums at the action boundary

**Choice:** Page passes `profile: Profile | null` and `email`. Form uses controlled/default values from that object — no “Faizan Ali” / mock skills. Selects include a blank option when the stored enum is null.

Mapping tables live next to the action (or `lib/profile-completion.ts`) so the client sends labels or native `<select>` values and the server canonicalizes. Client may send the schema value if the `<option value>` is the schema enum; either way the server validates against the allow-list and rejects unknown strings.

Comma-separated `job_titles_seeking` and `preferred_locations` split/trim on the server. Skills/industries stay arrays (hidden inputs or FormData keys). Work experience JSON parsed from FormData; max 3 roles; strip blanks.

JSON shapes:

```ts
type WorkExperienceRole = {
  company: string;
  job_title: string;
  start_date: string; // YYYY-MM
  end_date: string | null;
  currently_working: boolean;
  responsibilities: string;
};

type Education = {
  degree: "high_school" | "associate" | "bachelors" | "masters" | "phd";
  field: string;
  institution: string;
  year: string;
};
```

### 7. File checks on picker, drop, and server

**Choice:** Client: `file.type === 'application/pdf'` and `file.size <= 5 * 1024 * 1024` on both input `change` and drop (Feature 05 only checked drop type). Server: same checks on the `File` from FormData before upload. Do not write the buffer to disk.

## Risks / Trade-offs

- **[Risk] InsForge MCP/CLI unavailable while applying the migration** → Keep SQL in `db/migrations/002_add_resume_pdf_key.sql`. Human gate: do not claim E2E upload until `get-table-schema` (or equivalent) shows `resume_pdf_key`. App code can ship; upload fails loudly until the column exists.
- **[Risk] Storage upload returns a key that is not `{userId}/...`** → Reject the upload and do not persist if the returned key’s first segment is not `user.id` (defense in depth on top of sending that prefix).
- **[Risk] Stub profile row from resume-only upload** → Completion treats missing required fields as incomplete; first Save updates the same row. Acceptable.
- **[Risk] Delete of old resume fails** → New key is already saved (one active pointer). Orphan object possible; log `[actions/profile]` and continue. Matches “one active resume” at the profile level.
- **[Trade-off] File bytes go through the Next.js server** → Simpler auth/RLS than browser upload; 5MB cap keeps it acceptable.
- **[Trade-off] Completion counts work experience / education as one slot each** → Banner stays short; matches the mock’s “Education” tag rather than four education chips.

## Migration Plan

1. Commit `db/migrations/002_add_resume_pdf_key.sql`: `alter table public.profiles add column if not exists resume_pdf_key text;`
2. Apply with InsForge MCP `run-raw-sql` or `insforge-cli` (same as Feature 04). No RLS change — column rides existing profiles policies.
3. Deploy app code that reads/writes the column.
4. Rollback: stop writing `resume_pdf_key`; column can remain (nullable, unused). Do not drop it in a hurry — Feature 07 will need it.

No new env vars. Existing: `NEXT_PUBLIC_INSFORGE_URL`, `NEXT_PUBLIC_INSFORGE_ANON_KEY`. Storage bucket `resumes` already created.

## Open Questions

None. Remaining Feature 05 minors (remove-role control, SelectField extraction) stay deferred.
