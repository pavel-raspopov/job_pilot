# Progress Tracker

Update this file after every completed feature. Any AI agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 2 — Profile Page (in progress)
**Last completed:** 05 Profile Page — Full UI
**Next:** 06 Profile Save Logic

---

## Progress

### Phase 1 — Foundation

- [x] 01 Homepage
- [x] 02 Auth
- [x] 03 PostHog Initialization
- [x] 04 Database Schema

### Phase 2 — Profile Page

- [x] 05 Profile Page — Full UI
- [ ] 06 Profile Save Logic
- [ ] 07 AI Profile Extraction from Resume
- [ ] 08 Resume PDF Generation from Profile

### Phase 3 — Find Jobs Page

- [ ] 09 Find Jobs Page — Full UI
- [ ] 10 Adzuna Job Discovery
- [ ] 11 Filter + Sort + Pagination

### Phase 4 — Job Details Page

- [ ] 12 Job Details Page — Full UI
- [ ] 13 Company Research Agent

### Phase 5 — Dashboard

- [ ] 14 Dashboard Page — Full UI
- [ ] 15 Stats Bar — Real Data
- [ ] 16 Recent Activity — Real Data
- [ ] 17 Analytics Charts — PostHog Data

---

## Decisions Made During Build

- **Feature 05 Profile Page — "Cover Letter Tone" dropdown omitted (2026-07-31).** `build-plan.md` Feature 05 lists it under Job Preferences, but the binding design (`context/designs/profile.png`) omits it and cover-letter generation is explicitly out of product scope. User confirmed: design wins. The `profiles.cover_letter_tone` DB column stays; the UI never exposes it unless a cover-letter feature is scoped.
- **Feature 05 Profile Page — scope decisions.** Mock UI with local client-side interactivity only (skill/industry tags add-remove, up to 3 work-experience roles via "+ Add role", Currently-working checkbox disables End Date, resume dropzone shows the selected filename). No save/upload logic, no `profile_completed` event (both Feature 06). Email is the one real value — pre-filled read-only from the InsForge session in the server page. Attention banner (70% ring, PHONE/LOCATION/EDUCATION tags) is hardcoded mock; real completion math arrives with Feature 06. Banner markup lives in `app/(app)/profile/page.tsx` composing `CompletionIndicator` — architecture.md's component tree lists exactly `ProfileForm` / `ResumeUpload` / `ResumePreview` / `CompletionIndicator`, so no extra banner component was invented; `ResumePreview.tsx` is deferred until a feature displays an uploaded resume.

- **Match-score bar color thresholds reconciled (2026-07-31).** `ui-tokens.md` and `ui-rules.md` disagreed on fill ranges (90/70/50 vs 80/60 breakpoints). Resolved in favor of `ui-tokens.md` because its green-from-70 boundary matches the product's High Match filter (`match_score >= 70`, build-plan.md Feature 11). Canonical: green (#10B981) at 70–100, orange (#FF8904) at 50–69, gray (#99A1AF) below 50; blue never appears in score bars. `ui-rules.md` and root `DESIGN.md` updated to agree. Applies when Features 09–12 build the score bar.
- **Feature 04 Database Schema — "tailored fields" on `jobs` skipped.** `build-plan.md` Feature 04 mentions "tailored fields", but the `jobs` schema in `architecture.md` (the schema source of truth) has no such columns and no feature in the 17-feature plan ever writes tailored-resume or cover-letter data (the dashboard's tailoring chart and cover-letter stat are mock-only in Feature 14; Feature 15 replaces the cover-letter stat with "Jobs This Week"). Built exactly the `architecture.md` schema. If a tailoring feature is added later, add the columns then.
- **Feature 04 Database Schema — `user_id` FKs reference `auth.users(id)`, not `profiles(id)`.** A `profiles` row only exists after the user first saves their profile (Feature 06), so referencing `profiles` would block agent runs for users without a saved profile (or force a profile-creation trigger, out of scope for a schema-only feature). Since `profiles.id` = `auth.users.id`, the values are identical. `profiles.id` itself references `auth.users(id) ON DELETE CASCADE`.
- **Feature 04 Database Schema — implementation details.** Migration SQL committed at `db/migrations/001_initial_schema.sql` (source of truth), applied via InsForge MCP `run-raw-sql`. CHECK constraints on agent-written enum-ish columns (`agent_runs.status`, `jobs.source`, `jobs.match_score` 0–100, `agent_logs.level`); profiles dropdown fields stay free text (UI-constrained). RLS enabled on all four tables with per-operation policies on `auth.uid()` (no `TO` role clause — the `auth.uid()` check is the gate; anon matches nothing). `jobs.run_id` and `agent_logs.job_id` are nullable with `ON DELETE SET NULL`. Private `resumes` bucket created; per-user path scoping is mediated server-side (InsForge storage has no path-scoped policy surface). Verified: `get-table-schema` on all four tables, bucket in metadata, and a live negative RLS test (anon-key REST read returns `[]`, anon-key insert rejected with 42501). `ui-registry.md` untouched — no UI in this feature.

- **Feature 03 PostHog Initialization — scoped to init + identify + reset only.** A `/review` pass found the branch had drifted ahead of the plan: it added marketing-funnel events (`landing_cta_clicked` via a `components/CTALink.tsx` + `.posthog-events.json`) and bespoke auth capture events (`oauth_sign_in_started`, `sign_in_completed`, `sign_in_failed`, `sign_out`), none of which are in the approved event list in `code-standards.md`. Per "don't build ahead of the stage," all of these were removed. Feature 03 now contains exactly: client init (`instrumentation-client.ts`), client-side `identify` (`components/PostHogIdentify.tsx`, rendered in `app/(app)/layout.tsx`), and client-side `reset` on logout (new `components/layout/LogoutButton.tsx`). The four product events (`job_search_started`, `job_found`, `profile_completed`, `company_researched`) remain deferred to their owning features.
- **Context docs reconciled to the real init approach.** The PostHog sections of `library-docs.md` / `code-standards.md` / `architecture.md` were written for an older pattern (`lib/posthog-client.ts` + `initPostHog()` + `NEXT_PUBLIC_POSTHOG_KEY` + manual pageviews). Updated to match the actual, correct Next.js 15.3+ setup: init in root `instrumentation-client.ts`, env var `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `/ingest` reverse proxy in `next.config.ts`, and autocapture + automatic pageviews left ON. `lib/posthog-server.ts` is kept as initialized scaffolding for the future server-side events but is currently unused.
- **Homepage components consolidated to match architecture.md** — Testimonial.tsx and BottomCTA.tsx were originally built as separate components, but a review flagged that architecture.md only plans for `Hero.tsx`, `HowItWorks.tsx`, `Features.tsx` under `components/homepage/`. Merged the testimonial quote section and bottom gradient CTA banner into a single `HowItWorks.tsx` component (neither section is reused elsewhere on the site). `app/page.tsx` and `ui-registry.md` updated accordingly.
- **Button radius/padding standardized** — CTAButtons.tsx and Navbar.tsx's "Start for Free" button originally used `rounded-lg` / `px-6 py-2.5`, which drifted from the documented button token spec (`rounded-md`, `px-4 py-2` per ui-tokens.md and ui-rules.md). Fixed to match tokens exactly.
- **Removed Playfair Display font** — Testimonial quote (now inside HowItWorks.tsx) previously used `next/font/google` Playfair Display for stylistic emphasis. This violated the "Inter only" font invariant in ui-tokens.md. Replaced with Inter (project default) using `font-semibold italic` for visual distinction instead of a secondary typeface.
- **CTA auth-aware routing deferred** — build-plan.md specifies "Get Started"/"Start for Free" should route to `/dashboard` if authenticated, `/login` if not. This logic is intentionally deferred until Feature 02 Auth is built, since no auth state exists yet. All CTAs currently route to `/login` unconditionally. Must be revisited once auth is implemented.
- **Feature 02 Auth — post-review cleanup** — a 3-layer `/review` surfaced 16 issues on the initial auth build. Fixes applied before Feature 03:
  - **File layout aligned to architecture.md**: renamed `lib/insforge/client.ts` → `lib/insforge-client.ts` and `lib/insforge/server.ts` → `lib/insforge-server.ts`; moved `app/login/` → `app/(auth)/login/` and callback → `app/(auth)/callback/page.tsx`; removed dead `app/api/auth/callback|github|google/` folders.
  - **Server-action auth**: replaced form-action + separate route handlers with `actions/auth.ts` (`'use server'`) using `createAuthActions` + `skipBrowserRedirect: true`, returning `{success, url?, error?}` to the client for controlled redirect.
  - **OAuth callback fix**: previously used `createServerClient` (read-only cookies) so session cookies could never be written. Now uses `createAuthActions` (full `CookieStore`) inside the `(auth)/callback` server page, then `redirect('/dashboard')`; `NEXT_REDIRECT` errors are re-thrown so Next's redirect propagates.
  - **Middleware type safety**: removed all `any` and `@ts-ignore`; typed `CookieStore` with a single commented `as CookieStore` cast justified by the SDK's overloaded `set?/delete?` signatures that can't be satisfied by a single-signature arrow.
  - **Design-token compliance**: rewrote login page and dashboard to use only tokens (`bg-background`, `bg-surface`, `bg-surface-secondary`, `bg-overlay-dark`, `border-border`, `text-text-primary/secondary/muted`, `bg-accent`, `text-accent-foreground`, `focus:ring-accent`). No raw Tailwind color classes or hex values remain.
  - **Brand icons**: `lucide-react` has no GitHub/Google marks — inlined FontAwesome-style GitHub SVG (496×512) and multicolor Google SVG (24×24) directly in the login page.
  - **Navbar split**: `Navbar.tsx` is now an async server component that reads session via `createInsforgeServer()`; client-only active-link highlighting extracted to `components/layout/NavbarNav.tsx` (`usePathname`).
  - **CTA auth-aware routing implemented**: `CTAButtons.tsx` now switches destination based on server-side session, resolving the previously deferred item.
  - Middleware protects `/dashboard`, `/profile`, `/find-jobs`; dashboard's redundant server-side redirect removed.
- **Feature 02 Auth — round-2 review fixes** — a second `/review` pass surfaced 10 more issues after the initial cleanup. Fixed 7, deferred 3 to `memory.md`:
  - **#1** `context/architecture.md` "InsForge Client Pattern" updated to `@insforge/sdk/ssr` with `cookies: cookieStore` shape, plus a `createAuthActions` example for cookie-writing flows.
  - **#2** `lib/insforge-server.ts` gained a JSDoc warning that `createServerClient` is read-only; cookie-writing auth must use `createAuthActions` inline in a Server Action or Route Handler.
  - **#3** Layout consolidation via route group `app/(app)/` — shared `layout.tsx` renders Navbar + main + Footer around all authed pages; dashboard moved from `app/dashboard/` to `app/(app)/dashboard/`.
  - **#4** OAuth `redirectTo` is now server-pinned via `NEXT_PUBLIC_APP_URL` or `headers()` inside `signInWithOAuthAction`. Client no longer supplies a redirect URL.
  - **#5** Added `--shadow-card` elevation token in `app/globals.css` `@theme` (Tailwind v4). Login card + dashboard card use the generated `shadow-card` utility instead of duplicated inline `shadow-[...]`. Documented in `context/ui-tokens.md`.
  - **#6** `useSearchParams()` in the login page wrapped in `<Suspense>` — silences Next 15/16 warning.
  - **#7** Logout converted from `POST /api/auth/logout` route handler to `signOutAction` Server Action that calls `revalidatePath('/', 'layout')` before `redirect('/login')`. Fixes stale router cache after sign-out. Navbar uses `<form action={signOutAction}>`. `app/api/auth/` removed.
  - **Deferred (see `memory.md`):** #8 callback error observability / request-ID, #9 `lib/env.ts` zod validator to replace `!` assertions, #10 dashboard `/profile` link 404 (expected until Feature 05).

---

## Notes

_Add notes here as the build progresses — workarounds, patterns, anything that differs from the context files._

- **Tech debt #9 resolved (2026-07-26):** Added `lib/env.ts` — zod-validated env, exported as typed `env`. All InsForge env access refactored from `process.env.X!` to `env.X` across `lib/insforge-client.ts`, `lib/insforge-server.ts`, `actions/auth.ts`, `proxy.ts`, `app/(auth)/callback/route.ts`. Installed `zod ^4.4.3`. Canonical env pattern documented in `code-standards.md`. Tech debt #8 (callback request-ID) and #10 (`/profile` 404) reassessed and deferred/no-action — see `memory.md`.
