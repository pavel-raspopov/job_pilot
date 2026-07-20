# Progress Tracker

Update this file after every completed feature. Any AI agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 1 — Foundation
**Last completed:** 01 Homepage
**Next:** 02 Auth

---

## Progress

### Phase 1 — Foundation

- [x] 01 Homepage
- [ ] 02 Auth
- [ ] 03 PostHog Initialization
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

- **Homepage components consolidated to match architecture.md** — Testimonial.tsx and BottomCTA.tsx were originally built as separate components, but a review flagged that architecture.md only plans for `Hero.tsx`, `HowItWorks.tsx`, `Features.tsx` under `components/homepage/`. Merged the testimonial quote section and bottom gradient CTA banner into a single `HowItWorks.tsx` component (neither section is reused elsewhere on the site). `app/page.tsx` and `ui-registry.md` updated accordingly.
- **Button radius/padding standardized** — CTAButtons.tsx and Navbar.tsx's "Start for Free" button originally used `rounded-lg` / `px-6 py-2.5`, which drifted from the documented button token spec (`rounded-md`, `px-4 py-2` per ui-tokens.md and ui-rules.md). Fixed to match tokens exactly.
- **Removed Playfair Display font** — Testimonial quote (now inside HowItWorks.tsx) previously used `next/font/google` Playfair Display for stylistic emphasis. This violated the "Inter only" font invariant in ui-tokens.md. Replaced with Inter (project default) using `font-semibold italic` for visual distinction instead of a secondary typeface.
- **CTA auth-aware routing deferred** — build-plan.md specifies "Get Started"/"Start for Free" should route to `/dashboard` if authenticated, `/login` if not. This logic is intentionally deferred until Feature 02 Auth is built, since no auth state exists yet. All CTAs currently route to `/login` unconditionally. Must be revisited once auth is implemented.


---

## Notes

_Add notes here as the build progresses — workarounds, patterns, anything that differs from the context files._
