# UI Registry

Living document. Updated after every component is built. Read this before building any new component — match existing patterns exactly before inventing new ones.

---

## How to Use

Before building any component:

1. Check if a similar component already exists here
2. If yes — match its exact classes
3. If no — build it following ui-rules.md and ui-tokens.md, then add it here

After building any component — update this file with the component name, file path, and exact classes used.

---

## Components

- **Navbar**: `components/layout/Navbar.tsx` — 3-column grid header, logo image, centered nav links, dark `Start for Free` CTA (`rounded-md`, `px-4 py-2`)
- **Footer**: `components/layout/Footer.tsx` — logo left, Dashboard / Privacy Policy / Terms links right
- **CTAButtons**: `components/homepage/CTAButtons.tsx` — dark `Get Started` + outlined `Find Your First Match`, both `rounded-md`, `px-4 py-2` per button tokens
- **Hero**: `components/homepage/Hero.tsx` — centered headline, gradient orbs, dashboard screenshot below
- **Features**: `components/homepage/Features.tsx` — two alternating sections with feature lists + images
- **HowItWorks**: `components/homepage/HowItWorks.tsx` — combines testimonial quote section (Inter font, italic/semibold for emphasis) + gradient bottom CTA banner with `CTAButtons`. Matches architecture.md naming — replaces the previously separate `Testimonial.tsx` and `BottomCTA.tsx` (merged, single-use sections not reused elsewhere).
- **NavbarNav**: `components/layout/NavbarNav.tsx` — `"use client"` nav-links list extracted from Navbar. Uses `usePathname` to highlight the active route with `text-accent` (inactive: `text-text-dark`). Rendered by the async server `Navbar`.
- **Card (surface)**: canonical container used for auth card, dashboard panels, and any future content panel. Classes: `bg-surface border border-border rounded-2xl p-6 shadow-card`. Never use inline `shadow-[...]` — always the `shadow-card` token. Padding is `p-6` (not `p-8`) unless a specific case documents an override.
- **OAuth Button — secondary (light)**: `w-full flex items-center justify-center gap-3 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-secondary transition-colors focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60 disabled:cursor-not-allowed`. Icon `h-5 w-5`. Used for Google.
- **OAuth Button — primary (dark)**: `w-full flex items-center justify-center gap-3 rounded-md bg-overlay-dark px-4 py-2 text-sm font-medium text-surface hover:opacity-90 transition-opacity focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60 disabled:cursor-not-allowed`. Icon `h-5 w-5`. Used for GitHub. Matches the Navbar "Start for Free" CTA style — reuse for any primary CTA.
- **Alert / Notice banner**: `rounded-md border border-border bg-surface-secondary px-3 py-2 text-sm text-text-primary` with `role="alert"`. Neutral tone — the design system has no error/success color yet, so all inline notices use this surface. When error/success tokens land, add variants here.
- **Login Page**: `app/(auth)/login/page.tsx` — `"use client"`. Root: `min-h-screen flex items-center justify-center bg-background p-4`. Renders `<Suspense fallback={<LoginCardFallback/>}>` around `LoginCard` (consumes `useSearchParams`). Card matches the **Card (surface)** pattern (`max-w-md`). Heading `text-2xl font-semibold text-text-primary mb-2`, sub-copy `text-sm text-text-secondary`. Body `space-y-3` between OAuth buttons — Google uses **secondary** variant, GitHub uses **primary** variant. Footer legal copy `text-center text-xs text-text-muted` with underlined `text-text-secondary hover:text-text-primary` links. Provider click calls `signInWithOAuthAction(provider)` — no client-supplied `redirectTo`.
- **(app) Layout**: `app/(app)/layout.tsx` — shared authed shell around all protected routes: `<div className="flex flex-col min-h-screen">` wrapping `<Navbar />`, `<main className="flex-grow">{children}</main>`, `<Footer />`. Route-group `(app)` does not affect URL. Every page under `(app)/` renders content only — never its own navbar/footer.
- **Dashboard Page**: `app/(app)/dashboard/page.tsx` — async server component. Page container `mx-auto max-w-[1440px] px-8 py-8`. Uses the **Card (surface)** pattern for its panel. Heading `text-2xl font-semibold text-text-primary mb-2`, body `text-sm text-text-secondary`. Sign-out lives in Navbar (`<form action={signOutAction}>`) — never render a logout button inline on a page.

---

## Button Standard

All buttons use `rounded-md` (8px) and `px-4 py-2` padding per ui-tokens.md / ui-rules.md. Do not use `rounded-lg` or larger custom padding on buttons.

## Card Standard

All content panels use the **Card (surface)** pattern above: `bg-surface border border-border rounded-2xl p-6 shadow-card`. Elevation is `shadow-card` — never inline arbitrary shadow classes. `rounded-2xl` for cards, `rounded-md` for controls.

## Focus State Standard

Interactive controls use `focus:outline-none focus:ring-1 focus:ring-accent` (1px accent ring). Do not use `ring-2` or non-accent ring colors.

## Font Standard

Only Inter is used throughout, imported via `next/font/google` in the root layout. No secondary display fonts (e.g. Playfair Display) — use font-weight and italic styling for emphasis instead.
