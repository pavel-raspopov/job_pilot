# Memory — Homepage Review & Fixes

Last updated: 7/20/2026, 7:15 PM

## What was built

- **`components/homepage/HowItWorks.tsx`**: New component created by merging the previously separate `Testimonial.tsx` and `BottomCTA.tsx`. Contains the testimonial quote section and the gradient bottom CTA banner as two sections in one exported component, matching architecture.md's planned `HowItWorks.tsx` naming. `Testimonial.tsx` and `BottomCTA.tsx` were deleted.
- **`app/page.tsx`**: Updated to import and render `HowItWorks` instead of `Testimonial` + `BottomCTA`.
- **`components/homepage/CTAButtons.tsx`**: Button classes fixed from `rounded-lg` / `px-6 py-2.5` to `rounded-md` / `px-4 py-2` to match ui-tokens.md / ui-rules.md button spec exactly.
- **`components/layout/Navbar.tsx`**: "Start for Free" button radius fixed from `rounded-lg` to `rounded-md`. Logo `Image` width/height props corrected from `130x36` to `106x36` to match the actual logo.png intrinsic aspect ratio (496x168 ≈ 2.95:1), resolving a Next.js console warning.
- **`components/layout/Footer.tsx`**: Same logo width/height fix as Navbar (`106x36`).
- **`components/homepage/HowItWorks.tsx` quote styling**: Removed `Playfair_Display` font import (violated the "Inter only" font invariant) and removed heavy `font-semibold italic` styling that looked awkward in Inter — settled on `font-medium` (no italic) for a cleaner look.

## Decisions made

- **Architecture alignment over ad-hoc file creation**: When a `/review` surfaced that `Testimonial.tsx` + `BottomCTA.tsx` weren't in architecture.md's planned component list (which only specifies `Hero.tsx`, `HowItWorks.tsx`, `Features.tsx`), the decision was to conform the code to the plan rather than update the plan — merged into one `HowItWorks.tsx` file since neither section is reused elsewhere.
- **Button tokens are non-negotiable** — `rounded-md` + `px-4 py-2` is the fixed standard for all buttons project-wide; documented explicitly in `ui-registry.md` under a new "Button Standard" section to prevent future drift.
- **Single font family enforced** — only Inter is permitted anywhere in the UI; documented in `ui-registry.md` under "Font Standard". Emphasis in text is achieved via weight/italic utility classes, never a second typeface.
- **CTA auth-aware routing intentionally deferred** — Get Started / Start for Free currently route unconditionally to `/login`. Per build-plan.md this should be conditional on auth state (`/dashboard` if logged in), but that logic is deferred until Feature 02 Auth exists. Documented in progress-tracker.md so it isn't forgotten.

## Problems solved

- **Next.js Image aspect-ratio console warning**: Root cause was NOT the CSS override (as initially assumed) — it was that the `width={130} height={36}` props didn't match logo.png's actual intrinsic aspect ratio (496x168 ≈ 2.95:1, not 3.61:1). Fixed by reading the PNG header bytes directly (`node -e "fs.readFileSync..."`) to get true dimensions, then correcting width to `106` to preserve the real ratio at `height=36`.
- **Turbopack fatal panic / stray `nul` file**: An earlier command used `2>nul` (Windows cmd syntax) inside a Git Bash/MinGW shell, which created a literal 0-byte file named `nul` in the project root instead of redirecting to the null device. This broke Turbopack's file system reads (`nul` is a reserved Windows device name) causing a fatal panic and 500 errors on every route. Fixed by deleting the stray file (`rm -f nul`) and restarting the dev server with `.next` cache cleared.
- **Stale `.next` type-check cache**: `npm run build` initially failed on a phantom `app/login/page.js` type error even after removing the empty `app/login` folder — resolved by deleting the `.next` directory entirely before rebuilding.

## Current state

- Homepage (Phase 1 — Feature 01) fully rebuilt to match architecture.md's component plan, ui-tokens.md button/font specs, and verified visually in-browser against the running dev server (design comparison against `context/designs/landing-page.png` done by the user directly, confirmed "looking fine").
- `npm run build` and `npm run lint` both pass cleanly.
- `context/progress-tracker.md` has a "Decisions Made During Build" section documenting all fixes from this session.
- `context/ui-registry.md` has the updated component list (HowItWorks replacing Testimonial/BottomCTA) plus new "Button Standard" and "Font Standard" sections.
- **Pending, deliberately deferred by user**: rename `components/homepage/CTAButtons.tsx` → `CTAButton.tsx` (singular, since it's one reusable component, not a "buttons" collection) and update all references (`Hero.tsx`, `HowItWorks.tsx` currently import it). User explicitly said to forget this for now — it is NOT done.

## Next session starts with

- Proceed to **Phase 1 — Feature 02 Auth** (InsForge Google + GitHub OAuth, callback handler, session middleware protecting `/dashboard`, `/profile`, `/find-jobs`, `/find-jobs/[id]`), and revisit the deferred CTA auth-aware routing logic at that time.

## Open questions

- None.
