# Memory — AI setup repair + InsForge project migration

Last updated: 8/27/2026

## What was built

- **No product code changed this session.** Feature 06 remains the last shipped feature; Feature 07 AI Profile Extraction from Resume is still next.
- **Agent config now works in all three harnesses.** `.agents/skills/` is the single source of truth; `npm run sync:agents` copies it into `.claude/skills/` + `.claude/commands/`, `.cursor/skills/` + `.cursor/commands/`, and `.clinerules/workflows/`. `npm run check:sync` reports drift. Before this, every slash command in the AGENTS.md routing table silently failed in Claude Code.
- **`scripts/check-agent-config.mjs`** (`npm run check:agents` / `npm run fix:agents`) detects and repairs InsForge's overwrites of `AGENTS.md` and `.mcp.json`.
- **`.mcp.json` + `.cursor/mcp.json`** declare `insforge` and `posthog`, credentials as `${VAR}` only. Real values live in `.claude/settings.local.json` (gitignored).
- `openspec/config.yaml` fixed — 8 colon-bearing list items quoted. `AGENTS.md` gained an Environments section. `eslint.config.mjs` ignores `.agents/`, `.cursor/`, `.claude/`.

## Decisions made

- **`.agents/skills/` is canonical.** Never hand-edit `.claude/`, `.cursor/`, `.clinerules/` — they are generated. The sync script rewrites `/openspec-*-change` to `/opsx-*` on the way out, because the command name is what exists in every harness; that difference is deliberate, not drift.
- **Cline gets workflows only, no skills tree.** Everything under `.clinerules/` is loaded into the system prompt, so copying the 270KB skill tree there would poison every session. Skills are read on demand from `.agents/skills/`.
- `openspec` must be installed **globally** on every machine (`npm i -g @fission-ai/openspec`) — the `opsx-*` commands call the bare binary at 20+ sites, and a devDependency does not put it on PATH.
- Node 26.8.1 via nvm. Next.js 16 requires >=20.9. `DEP0205` remains expected Turbopack noise.
- The June backup was **not** used — see below.

## Problems solved

- **InsForge project was recreated; the app was pointed at the dead one.** `.env.local` held `36rdi9mz.eu-central.insforge.app` (old, paused). The live project is `gyht9mqy.eu-central.insforge.app`. `.env.local` now has the new URL + a freshly issued anon key. Old values saved at `.env.local.bak-old-project` (gitignored).
- **The new backend was empty.** Restored by applying `db/migrations/001_initial_schema.sql` and `002_add_resume_pdf_key.sql` via MCP `run-raw-sql`, plus recreating the private `resumes` bucket. Verified: 4 tables, RLS on all, 4 policies each, `profiles` has 25 columns incl. `resume_pdf_key`, FK to `auth.users` ON DELETE CASCADE. **No user data survived** — `auth.users` is empty, so sign in again to create a fresh user.
- **`20260617_024752.sql.gz` is useless as a restore.** It is a platform-only dump dated *before* Feature 04 built the schema: zero occurrences of `profiles`/`agent_runs`/`agent_logs`/`resume_pdf_key`, zero rows in `storage.buckets`, no `public.*` data. It is also from an older InsForge platform version and opens with DROP statements, so restoring it would have damaged the new instance. Do not retry it. Delete it — it contains `system.secrets` and encrypted OAuth credentials.
- **InsForge tooling overwrites config on MCP startup.** It replaced `AGENTS.md` wholesale with its own SDK boilerplate (giveaway: `# InsForge SDK Documentation`) and replaced the `${INSFORGE_API_KEY}` placeholder in `.mcp.json` with the **literal admin key**, in a file that is not gitignored. Both are now guarded by `npm run check:agents`. If `AGENTS.md` looks wrong, run it before anything else.
- **PostHog was never misconfigured.** The token in `.env.local` matches MCP project `232263` exactly. The old "events look missing" symptom was only the browser being signed into a different org. Closes the prior open question.
- Observation 5 closed (ACTIONED 2026-08-27): `openspec` CLI now loads `openspec/config.yaml` instead of falling back to defaults, so its proposal/spec/design/task rules bind for the first time.

## Current state

- `npm run lint`, `npm run build`, `npm run check:agents`, `npm run check:sync` all pass on Node 26.8.1.
- InsForge and PostHog MCP both connected and verified.
- **Feature 06 re-verified end-to-end against the restored backend** (2026-08-27). See below.

## Feature 06 verification against the new backend

Signed in via OAuth (fresh user `4b0f26da-e573-4ddd-a32b-b1f97e22d071`), then confirmed:

- Email pre-filled read-only from the session; no Cover Letter Tone field (Feature 05 decision holds).
- First save created the profile row with all scalars, `skills` / `job_titles_seeking` arrays, and both jsonb columns (`education`, `work_experience`).
- `is_complete` correctly stayed **false** at that point: `isWorkRoleComplete` requires `currently_working || end_date` and the role had neither. Banner read 92% (11/12) with `WORK EXPERIENCE` the only missing tag — matches the formula exactly.
- Ticking "Currently working here" disabled End Date, and saving flipped `is_complete` to true. Banner then hidden on reload, form pre-filled from the row.
- `profile_completed` fired once, 411ms after the save committed (PostHog `18:48:57.980Z` vs `updated_at 18:48:57.569Z`), distinct_id = the user id. `$identify` correctly aliased the anonymous id.
- Resume upload on file select stored `{userId}/resume.pdf` in the private `resumes` bucket (`uploaded_by` = user id) and persisted both `resume_pdf_url` and `resume_pdf_key`.

Testing notes for next time: CDP keystrokes do **not** update React state in this app's controlled inputs — drive them with the native value setter plus `input`/`change` events, or the fields without a `name` (work experience, tag inputs) serialize empty. PostHog EU ingestion lags roughly a minute; an immediate query returns nothing and that is not evidence the event failed.

## Next session starts with

`/remember restore`, then `/opsx-propose` Feature 07 AI Profile Extraction from Resume.

## Open questions

- **Rotate the InsForge admin key?** It was written in plaintext to `.mcp.json`. It was never staged or committed, so it is not in git history — rotation is prudent, not urgent.
- Cline and Cursor are not installed on this machine; `.clinerules/` and `.cursor/` configs are written to convention and unverified against a running instance.
- Feature 06 optional leftovers still open: save-success copy; reset the resume file input after upload. Add to that list: the skills/industries tag input does not clear after "Add" — the typed text stays in the box once the tag is created.
- Optional deferred: OAuth callback request-ID correlation (#8).
