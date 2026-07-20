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

---

## Button Standard

All buttons use `rounded-md` (8px) and `px-4 py-2` padding per ui-tokens.md / ui-rules.md. Do not use `rounded-lg` or larger custom padding on buttons.

## Font Standard

Only Inter is used throughout, imported via `next/font/google` in the root layout. No secondary display fonts (e.g. Playfair Display) — use font-weight and italic styling for emphasis instead.
