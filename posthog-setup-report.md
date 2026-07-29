# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the JobPilot Next.js App Router application. Client-side tracking is initialized via `instrumentation-client.ts` (Next.js 15.3+ pattern) with a reverse proxy configured in `next.config.ts` to route PostHog traffic through `/ingest` — avoiding ad blockers. A shared server-side PostHog client (`lib/posthog-server.ts`) is used across route handlers and server actions. Users are identified server-side immediately after successful OAuth callback, and client-side on every authenticated page load via `PostHogIdentify`.

| Event | Description | File |
|-------|-------------|------|
| `oauth_sign_in_started` | User clicks a social OAuth provider button (Google or GitHub) on the login page. | `app/(auth)/login/page.tsx` |
| `sign_in_completed` | OAuth callback successfully exchanged a code for a session, completing sign-in. | `app/(auth)/callback/route.ts` |
| `sign_in_failed` | OAuth callback failed to exchange the code or encountered an error during sign-in. | `app/(auth)/callback/route.ts` |
| `sign_out` | User signs out of the application via the Navbar logout button. | `actions/auth.ts` |

## Files created or modified

- **`instrumentation-client.ts`** (created) — Client-side PostHog initialization with EU host and reverse proxy
- **`next.config.ts`** (modified) — Reverse proxy rewrites for `/ingest` → EU PostHog endpoints
- **`lib/posthog-server.ts`** (created) — Singleton server-side PostHog client (`posthog-node`)
- **`components/PostHogIdentify.tsx`** (created) — Client component for user identification on authenticated pages
- **`app/(auth)/login/page.tsx`** (modified) — `oauth_sign_in_started` capture on provider button click
- **`app/(auth)/callback/route.ts`** (modified) — `sign_in_completed` / `sign_in_failed` captures + server-side user identification
- **`actions/auth.ts`** (modified) — `sign_out` capture before session destruction
- **`app/(app)/layout.tsx`** (modified) — Mounts `PostHogIdentify` on every authenticated page to handle returning-visitor identification

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://eu.posthog.com/project/232263/dashboard/848533)
- [Sign-in attempts by provider (wizard)](https://eu.posthog.com/project/232263/insights/1lw8XiRY)
- [Successful sign-ins over time (wizard)](https://eu.posthog.com/project/232263/insights/jC3XEGR2)
- [Sign-in failures by reason (wizard)](https://eu.posthog.com/project/232263/insights/a9AGK7d9)
- [Sign-outs over time (wizard)](https://eu.posthog.com/project/232263/insights/qNbNc4xd)
- [Auth conversion funnel (wizard)](https://eu.posthog.com/project/232263/insights/dYBeaWTz)

## Verify before merging

- [ ] Run a full production build (the wizard only verified the files it touched) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add the exact PostHog env var names (`NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST`) to `.env.example` and any monorepo/bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.
- [ ] Confirm the returning-visitor path also calls `identify` — the `PostHogIdentify` component in `app/(app)/layout.tsx` handles this, but verify it renders correctly for all authenticated routes.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
