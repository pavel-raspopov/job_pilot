# Memory — Tech Debt Triage (post Feature 03)

Last updated: 7/26/2026, 3:43 PM

## What was built

This session did no new feature work — it triaged and resolved the outstanding tech-debt backlog (#8–#14) carried from Features 02/03. Feature 03 (PostHog Init) remains complete from the prior session.

- **`lib/env.ts` (NEW):** zod schema validated once at module load, exporting a typed `env` constant for the two required vars (`NEXT_PUBLIC_INSFORGE_URL`, `NEXT_PUBLIC_INSFORGE_ANON_KEY`). Fails loudly with a readable message if missing/malformed.
- **Refactored 5 consumers** off `process.env.X!` → `env.X`: `lib/insforge-client.ts`, `lib/insforge-server.ts`, `actions/auth.ts` (2 call sites), `proxy.ts`, `app/(auth)/callback/route.ts`. No `!` env assertions remain in code.
- **Installed `zod ^4.4.3`** (was approved but not installed; will be reused for agent `extract` schemas + request-body validation).
- **Docs fixed (#11):** `context/library-docs.md` (2 imports) and `context/code-standards.md` (approved-deps line) corrected `@insforge/ssr` → `@insforge/sdk/ssr` / `@insforge/sdk`. Zero stale refs remain in `context/`.
- **Docs updated:** `context/code-standards.md` now documents `lib/env.ts` as the canonical env pattern; `context/progress-tracker.md` Notes records the #9 resolution.

## Decisions made

- **Env access is centralised in `lib/env.ts`.** Import `env` from `@/lib/env`; never `process.env.X!`. Add a new required var to the schema when its owning feature is built. Optional integrations that degrade gracefully (e.g. PostHog token) are read directly at their use site and must NOT be added to the schema.
- **`lib/posthog-server.ts` is intentional planned scaffolding, not debt (#13 resolved).** `getPostHogClient` is currently unused but is explicitly mandated by `build-plan.md` Feature 03 and consumed later by server-side events in Features 10 & 13. Keep it.
- **Next.js 16 audit stays per-feature (#14).** No standalone audit; fold Next 16 convention checks into the `/review` + verification pass on each new feature. Current surface already conforms (proxy.ts rename, awaited cookies()/headers(), no sync dynamic-API misuse).

## Problems solved

- **Opaque crashes on missing env** — replaced scattered `process.env.X!` with fail-fast zod validation at boot (#9).
- **Docs pointed at a non-existent package** (`@insforge/ssr`) — reconciled to the installed `@insforge/sdk` / `@insforge/sdk/ssr` (#11).
- **#12 signature uncertainty closed** — cross-checked core auth calls against live InsForge `auth-sdk` docs (all match: `signInWithOAuth(provider,{redirectTo,skipBrowserRedirect})`, `signOut()`, `getCurrentUser()→data.user`, callback reads `insforge_code`). The passing TypeScript build against `@insforge/sdk@^1.5.0` types is the authoritative check for the SSR subpath helpers.

## Current state

- **Phase 1 — Features 01 Homepage, 02 Auth, 03 PostHog Init all complete.** Next unbuilt feature: **04 Database Schema**.
- `npm run build` passes clean (compiled, TypeScript, static generation). `ReadLints` clean on all touched files.
- Tech-debt backlog fully triaged — see below. Only remaining *open* items are #8 (deferred, optional) and #10 (self-resolves at Feature 05); nothing blocks Feature 04.

## Next session starts with

- Proceed to **Phase 1 — Feature 04 Database Schema** per `context/build-plan.md`: create `profiles`, `agent_runs`, `jobs`, `agent_logs` tables + `resumes` storage bucket, all with RLS scoped by `user_id`. Use the InsForge MCP (`run-raw-sql`, `create-bucket`, `get-table-schema`) for infra; read `db-sdk` / `storage-sdk` docs first.

## Open questions / remaining tech debt

- **[#8] OAuth callback request-ID correlation — DEFERRED (optional).** Callback already logs server-side + shows human-readable errors; only per-request `x-request-id` correlation is missing. Production nicety, not needed for Phase 1.
- **[#10] `Profile` nav link 404 — NO ACTION.** Link lives in `NavbarNav.tsx`; 404s only because the profile page doesn't exist yet. Self-resolves at Feature 05.
- **Resolved this session:** #9 (env validation), #11 (stale package refs), #12 (signatures verified), #13 (posthog-server kept as intentional scaffolding), #14 (audit folded into per-feature review).
