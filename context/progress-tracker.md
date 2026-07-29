# Progress Tracker

Update this file after every completed feature. Any AI agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 1 — Foundation
**Last completed:** 03 PostHog Initialization
**Next:** 04 Database Schema

---

## Progress

### Phase 1 — Foundation

- [x] 01 Homepage
- [x] 02 Auth
- [x] 03 PostHog Initialization
- [ ] 04 Database Schema

### Phase 2 — Profile Page

- [ ] 05 Profile Page — Full UI
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
