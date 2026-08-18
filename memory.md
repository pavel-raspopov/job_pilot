# Memory — OpenSpec AI workflow

Last updated: 8/18/2026, 5:35 PM

## What was built

- Adopted OpenSpec (CLI 1.9.0) as the spec/apply/archive path. Init: `--tools cursor,agents --profile core`. Commands: `/opsx-explore`, `/opsx-propose`, `/opsx-apply`, `/opsx-archive` (plus sync/update). Config: `openspec/config.yaml`. Generated skills under `.cursor/skills/openspec-*` and `.agents/skills/openspec-*`; commands under `.cursor/commands/opsx-*.md`.
- Slimmed `AGENTS.md` (~90 lines): Tailwind v4, no InsForge SDK dump, tiered context loading, one skill-routing table, session order task-observer → remember restore → using-superpowers.
- Deleted four Tailwind skills (taught raw color classes / wrong repo). Superpowers `brainstorming`, `writing-plans`, `executing-plans` kept but superseded (do not auto-trigger).
- Ported chatbot-builder lessons into feature-review, TDD (no-runner exception), imprint + `/impeccable document`, recover → systematic-debugging, `.cursor/rules/memory-before-commit.mdc`, cross-cutting principle Skill-readable artifacts. `using-superpowers` now routes “Let’s build X” to OpenSpec.

## Decisions made

- OpenSpec owns agree-before-build, implement, and archive. Do not stack Superpowers planning on top. `/architect` runs inside explore/propose only — not a second plan format.
- Do not back-fill `openspec/specs/` from the 17-feature build-plan. Specs grow from real changes, starting with Feature 06.
- This repo has no test runner: verify with `npm run lint`, `npm run build`, and a manual click-through. Do not add a test framework unasked.
- Stale `build-plan.md` bullets (Cover Letter Tone, storage `upsert: true`) stay until Feature 06; reconcile as OpenSpec decisions. Design + product scope win by default. Persist returned storage key/url — no upsert.

## Problems solved

- AGENTS.md contradicted itself (read all 9 context files vs targeted loading) and locked Tailwind 3.4 while the app uses v4 `@theme`.
- Slimming AGENTS.md alone would still auto-invoke brainstorming; `using-superpowers` plan-mode gate had to change in the same commit.

## Current state

- Product: Feature 05 Profile UI is on `main` (`e6eb5d2`). Mock interactivity only; Save/upload inert. `/profile` works (auth-protected).
- Workflow: OpenSpec + slim AGENTS.md ready. Restart IDE if `/opsx-*` commands are missing from the picker.
- Feature 05 review minors still open (not blocking): PDF type check on drop only; no remove-role control; mock EDUCATION inconsistency; `SelectField`/`TagInput` still private in `ProfileForm.tsx`; dropdown labels vs schema enums (map on save).

## Next session starts with

`/remember restore`, then `/opsx-propose Feature 06 Profile Save Logic`. Server Action in `actions/profile.ts`, resume upload to InsForge Storage (no upsert — persist returned key/url; path isolation server-side), completion % / missing fields / `is_complete`, form pre-fill, `revalidatePath('/profile')`. Map dropdown UI labels → schema enum values on save.

## Open questions

- Extract `SelectField` / `TagInput` before Feature 06, or wait until reuse.
- Optional deferred: OAuth callback request-ID correlation (#8).
