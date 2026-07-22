# Memory — Feature 02 Auth Implementation

Last updated: 7/23/2026, 12:15 AM

## What was built

- **`lib/insforge-client.ts` / `lib/insforge-server.ts`**: Browser + server (read-only) InsForge clients via `@insforge/sdk/ssr` (`createBrowserClient`, `createServerClient`). Server client documented as read-only — cookie writes go through `createAuthActions`.
- **`proxy.ts`** (Next.js 16 renamed `middleware` → `proxy`): Session updater using `updateSession` from `@insforge/sdk/ssr`, guards `/dashboard`, `/profile`, `/find-jobs`, redirects unauthenticated users to `/login`.
- **`app/(auth)/callback/route.ts`**: OAuth code exchange as a Route Handler using `createAuthActions.exchangeOAuthCode` (must be a Route Handler / Server Action because it writes cookies).
- **`app/(auth)/login/page.tsx`**: Client login page with Google + GitHub OAuth. Uses `<Suspense>` around the `useSearchParams()`-consuming card. Calls the server action `signInWithOAuthAction(provider)` — redirect URL is now pinned server-side, not passed from the client.
- **`actions/auth.ts`**: Server Actions `signInWithOAuthAction` (resolves origin from `NEXT_PUBLIC_APP_URL` or `headers()`, calls `createAuthActions.signInWithOAuth` with `skipBrowserRedirect: true`, returns the OAuth URL to the client) and `signOutAction` (calls `createAuthActions.signOut`, then `revalidatePath('/', 'layout')`, then `redirect('/login')`).
- **`app/(app)/layout.tsx`** + **`app/(app)/dashboard/page.tsx`**: Route-group shared authed layout renders `<Navbar />` + `<main>` + `<Footer />`. Dashboard uses `shadow-card` token.
- **`app/globals.css`**: Added `--shadow-card` elevation token in `@theme`, generating a `shadow-card` utility (replaces the duplicated inline `shadow-[...]` arbitrary values).
- **`components/layout/Navbar.tsx`**: Server component that reads user via `createInsforgeServer()`. Logout is a `<form action={signOutAction}>` so the router cache is invalidated.
- **`components/homepage/CTAButtons.tsx`**: Async server component routing logged-in users to `/dashboard`.

## Decisions made

- **Route group `(app)` for authed layout.** Chose a route group over per-page duplication because Navbar/Footer are identical across dashboard, profile, find-jobs, and job details.
- **`signOutAction` Server Action instead of Route Handler.** Server Actions can call `revalidatePath('/', 'layout')` to blow the router cache. A POST route can't invalidate it, which caused stale sessions after logout.
- **OAuth `redirectTo` is server-pinned.** The client no longer passes the redirect URL; the server derives it from `NEXT_PUBLIC_APP_URL` (if set) or `headers()`. Prevents an open-redirect-style tampering vector.
- **`createServerClient` is read-only.** All cookie-writing auth uses `createAuthActions` inline in a Server Action or Route Handler. Documented in `lib/insforge-server.ts` JSDoc and `context/architecture.md`.
- **Shadow token in Tailwind v4 `@theme`.** Elevation lives in one place (`--shadow-card`) — components use `shadow-card`, never inline `shadow-[...]`.
- **UI patterns imprinted to `context/ui-registry.md`.** Reusable patterns extracted from this feature: **Card (surface)** = `bg-surface border border-border rounded-2xl p-6 shadow-card`; **OAuth Button primary (dark)** = `bg-overlay-dark text-surface hover:opacity-90`; **OAuth Button secondary (light)** = `border border-border bg-surface hover:bg-surface-secondary`; **Alert / Notice** = neutral `bg-surface-secondary` (no error token yet); **Focus State Standard** = `focus:ring-1 focus:ring-accent`. Registry previously drifted from actual code (listed `p-8`, `hover:bg-overlay-dark`) — corrected during imprint to match the shipped classes.

## Problems solved

- **OAuth callback previously swallowed cookie writes** — moved from Server Component to Route Handler.
- **Logout left stale session in router cache** — fixed with `revalidatePath('/', 'layout')` in `signOutAction`.
- **Next 15/16 `useSearchParams()` warning** — fixed with `<Suspense>` boundary around the login card.
- **Duplicated arbitrary shadow classes** — consolidated into `shadow-card` token.
- **Layout inconsistency between marketing and authed pages** — unified via `app/(app)/layout.tsx`.

## Current state

- Phase 1 — Feature 02 Auth **fully completed** through two rounds of review + fixes.
- `npx tsc --noEmit` passes clean. `npm run lint` clean for app code (pre-existing warnings in `.agents/skills/` only, out of scope).
- Sign-in via Google and GitHub OAuth verified end-to-end in dev server; sign-out clears session and router cache.
- `context/ui-registry.md` reflects real shipped patterns (Card / OAuth buttons / Alert / Focus / Card + Focus standards) — future components should match without re-reading source.

## Next session starts with

- Proceed to **Phase 1 — Feature 03 PostHog Initialization** per `context/build-plan.md`.

## Open points / deferred tech debt

Deferred from Feature 02 round-2 review (user instruction: fix 1–7, defer 8–10).

- **[#8] OAuth callback error observability.** `app/(auth)/callback/route.ts` currently redirects to `/login?error=…` on any failure but doesn't emit a correlation ID or log the underlying error. When a user reports a failed sign-in there is no trail. **Action for later:** attach a per-request `x-request-id`, log the error server-side with that ID, surface the ID in the query string, and echo it on the login page so it can be pasted into a bug report.
- **[#9] Env var validation.** Every server file uses `process.env.NEXT_PUBLIC_INSFORGE_URL!` / `..._ANON_KEY!` non-null assertions. A missing env crashes deep in InsForge SDK internals with a cryptic error. **Action for later:** create `lib/env.ts` with a zod-validated schema loaded once at boot; import typed constants everywhere; drop the `!` assertions.
- **[#10] Dashboard `Profile` link 404s.** Dashboard renders a nav link to `/profile` but Feature 05 (Profile page) is not yet built. Expected — will resolve when Feature 05 lands. No action needed now; noted so it isn't flagged again on the next review.
