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

- **Navbar**: `components/layout/Navbar.tsx` — 3-column grid header, logo image, centered nav links, dark `Start for Free` CTA
- **Footer**: `components/layout/Footer.tsx` — logo left, Dashboard / Privacy Policy / Terms links right
- **CTAButtons**: `components/homepage/CTAButtons.tsx` — dark `Get Started` + outlined `Find Your First Match`
- **Hero**: `components/homepage/Hero.tsx` — centered headline, gradient orbs, dashboard screenshot below
- **Features**: `components/homepage/Features.tsx` — two alternating sections with feature lists + images
- **Testimonial**: `components/homepage/Testimonial.tsx` — Playfair Display quote, Tom Wilson attribution
- **BottomCTA**: `components/homepage/BottomCTA.tsx` — gradient banner with headline + CTAButtons
