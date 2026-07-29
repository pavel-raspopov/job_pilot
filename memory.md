# Memory — Feature 04 Database Schema

Last updated: 7/29/2026, 4:46 PM

## What was built

- **Feature 04 Database Schema complete — Phase 1 Foundation is done.** All infra lives on the InsForge backend (verified live, not just in SQL):
  - Four tables: `profiles` (24 cols), `agent_runs` (8), `jobs` (23), `agent_logs` (7) — columns exactly per `architecture.md`.
  - RLS enabled on all four with 16 per-operation policies gated on `auth.uid()` (`profiles` keyed on `id`, others on `user_id`), `WITH CHECK` on INSERT/UPDATE.
  - CHECK constraints on agent-written enums (`agent_runs.status`, `jobs.source`, `jobs.match_score` 0–100, `agent_logs.level`); 4 indexes for Find Jobs / Dashboard query paths.
  - Private `resumes` storage bucket (non-public).
- **`db/migrations/001_initial_schema.sql` (NEW)** — the committed source of truth for the schema.
- Docs updated: `progress-tracker.md` (Feature 04 done + decisions), `architecture.md` (FK note under schema section + `db/` added to folder tree).
- Reviews all clean: Bugbot (0 findings), Security Review (0 findings), project 3-layer `/review` (3 minor items; folder-tree drift fixed, other two are documented trade-offs).

## Decisions made

- **"Tailored fields" on `jobs` skipped.** `build-plan.md` Feature 04 mentions them but `architecture.md` has no such columns and no feature in the 17-feature plan ever writes tailoring/cover-letter data. Add columns only if a tailoring feature is ever scoped.
- **`user_id` FKs reference `auth.users(id)`, not `profiles(id)`.** A profiles row only exists after Feature 06's first save; referencing `auth.users` avoids a profile-creation trigger and never blocks agent runs. `profiles.id` references `auth.users(id) ON DELETE CASCADE`.
- **No DB triggers.** Profile rows come from app-level upsert (Feature 06); `updated_at` is set by the Server Action.
- **Schema applied via MCP `run-raw-sql`, not InsForge's migration endpoint** — so it is NOT recorded in `system.custom_migrations`. The repo SQL file is the rebuild source of truth.

## Problems solved

- **`run-raw-sql` blocks `BEGIN/COMMIT` and `SET ROLE`** — RLS cannot be negative-tested via SQL role simulation. Test via the REST API instead: `GET/POST {baseUrl}/api/database/records/{table}` with the plain anon key. Verified: anon read returns `[]` (200), anon insert rejected with 42501 RLS violation (401).
- **InsForge storage has no `upsert: true`** (contrary to `build-plan.md` Features 06/08): uploading to an existing key auto-renames and returns a new key. Feature 06 must save the returned `key`/`url` from every upload (or delete-then-upload) instead of assuming a stable `resumes/{user_id}/resume.pdf` path.
- **InsForge storage has no path-scoped policies** — per-user isolation of `resumes/{user_id}/...` must be enforced server-side in Server Actions / API routes (bucket is private; all access is mediated).

## Current state

- **Phase 1 (Features 01–04) complete.** Next unbuilt feature: **05 Profile Page — Full UI**.
- Backend live and verified: 4 tables (0 rows), 16 policies, private `resumes` bucket (0 objects).
- **Feature 04 changes are NOT yet committed** — working tree has `M context/architecture.md`, `M context/progress-tracker.md`, untracked `db/`. Last commit is Feature 03 (`0ae7b52`).

## Next session starts with

- Commit the Feature 04 changes, then build **Feature 05 Profile Page — Full UI** per `build-plan.md`: complete profile page UI with mock data only (no save logic) — attention banner with completion ring, resume upload area, full profile form sections, Save button. This also resolves deferred item #10 (`/profile` nav 404).

## Open questions / notes for later

- **Security (informational, below threshold):** INSERT policies don't check that `run_id`/`job_id` belong to the inserting user. Fine while only server-side agent code writes `jobs`/`agent_logs`; add `EXISTS` ownership checks to policies if clients ever insert directly.
- **[#8] OAuth callback request-ID correlation** — still deferred, optional production nicety.
