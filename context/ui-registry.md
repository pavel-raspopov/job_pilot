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
- **Alert / Notice banner — neutral**: `rounded-md border border-border bg-surface-secondary px-3 py-2 text-sm text-text-primary` with `role="alert"`. Default for informational inline notices.
- **Alert / Notice banner — error**: use when the design requires attention/error (e.g. incomplete profile). Prefer Card (surface) + `text-error` icon/text + `bg-error/10` missing-field pills (see **Missing-field pill**). Tokens `--color-error` / `--color-success` and their washes exist in `app/globals.css` `@theme` — never claim they are missing.
- **Login Page**: `app/(auth)/login/page.tsx` — `"use client"`. Root: `min-h-screen flex items-center justify-center bg-background p-4`. Renders `<Suspense fallback={<LoginCardFallback/>}>` around `LoginCard` (consumes `useSearchParams`). Card matches the **Card (surface)** pattern (`max-w-md`). Heading `text-2xl font-semibold text-text-primary mb-2`, sub-copy `text-sm text-text-secondary`. Body `space-y-3` between OAuth buttons — Google uses **secondary** variant, GitHub uses **primary** variant. Footer legal copy `text-center text-xs text-text-muted` with underlined `text-text-secondary hover:text-text-primary` links. Provider click calls `signInWithOAuthAction(provider)` — no client-supplied `redirectTo`.
- **(app) Layout**: `app/(app)/layout.tsx` — shared authed shell around all protected routes: `<div className="flex flex-col min-h-screen">` wrapping `<Navbar />`, `<main className="flex-grow">{children}</main>`, `<Footer />`. Route-group `(app)` does not affect URL. Every page under `(app)/` renders content only — never its own navbar/footer.
- **Dashboard Page**: `app/(app)/dashboard/page.tsx` — async server component. Page container `mx-auto max-w-[1440px] px-8 py-8`. Uses the **Card (surface)** pattern for its panel. Heading `text-2xl font-semibold text-text-primary mb-2`, body `text-sm text-text-secondary`. Sign-out lives in Navbar (`<form action={signOutAction}>`) — never render a logout button inline on a page.
- **Profile Page**: `app/(app)/profile/page.tsx` — async server component. Standard page container, then a narrower `mx-auto max-w-4xl flex flex-col gap-6` column of cards. `sr-only` h1 for a11y. Composes the attention banner (inline), `ResumeUpload`, `ProfileForm` (passing session email).
- **Attention banner (profile)**: inline in profile page — **Card (surface)** with `flex items-center justify-between gap-6`; title row `CircleAlert h-4 w-4 text-error` + `text-base font-semibold`, sub-copy `text-sm text-text-secondary`, missing-field pills, `CompletionIndicator` right.
- **Missing-field pill (error tag)**: `rounded-full bg-error/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-error`. Error/success tokens exist in `@theme` — tint washes via the `/10`–`/15` opacity modifier on the token, never a raw color.
- **CompletionIndicator**: `components/profile/CompletionIndicator.tsx` — 64px SVG progress ring, track `stroke-error/15`, fill `stroke-error` (round cap, −90° start), centered `text-base font-semibold` percentage, `role="img"` + aria-label.
- **ResumeUpload**: `components/profile/ResumeUpload.tsx` — `"use client"` card. Dropzone is a `<label htmlFor>` for an `sr-only` file input: `rounded-md border border-dashed border-border-muted bg-surface-secondary px-6 py-10 text-center`, drag-over state `border-accent bg-accent-muted`, `CloudUpload h-6 w-6 text-accent` icon, "Select Resume" styled as secondary-button span. Footer row below `border-t border-border pt-4`: prompt text left, primary accent button with `FileText h-4 w-4` icon right.
- **ProfileForm**: `components/profile/ProfileForm.tsx` — `"use client"` card wrapping one `<form>`. Card header `text-base font-semibold` + sub-copy, sections as `<fieldset>`s in a `divide-y divide-border` stack (`py-6` each), section `<legend>` `text-sm font-semibold text-text-primary`. Full-width `Save Profile` primary button after `border-t pt-6`.
- **Field label**: `mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-secondary`.
- **Input / select / textarea**: `w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent disabled:bg-surface-secondary disabled:text-text-muted disabled:cursor-not-allowed`. Read-only variant adds `cursor-not-allowed bg-surface-secondary text-text-secondary`. Selects add `appearance-none pr-9 cursor-pointer` inside a `relative` wrapper with a `ChevronDown h-4 w-4 text-text-muted` positioned right.
- **Tag input + removable pill**: input flex-1 + secondary `Add` button (Enter also adds); pills `inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-secondary px-3 py-1 text-xs font-medium text-text-dark` with an `X h-3 w-3` remove button (`aria-label="Remove {tag}"`).
- **Accent text button**: "+ Add role" pattern — `flex items-center gap-1 text-sm font-medium text-accent hover:opacity-80` with `Plus h-4 w-4`. Use for inline add/expand actions inside cards.
- **Nested role card (form sub-block)**: inside ProfileForm Work Experience — `space-y-4 rounded-md border border-border p-4` (not a full Card surface; no shadow). Used for repeating editable entries inside a parent card. Two-tier radius only: `rounded-2xl` cards, `rounded-md` controls/sub-blocks — never `rounded-lg`.
- **Checkbox (form)**: `h-3.5 w-3.5 accent-accent` next to `text-xs font-medium text-text-dark` label.

---

## Button Standard

All buttons use `rounded-md` (8px) and `px-4 py-2` padding per ui-tokens.md / ui-rules.md. Do not use `rounded-lg` or larger custom padding on buttons.

## Card Standard

All content panels use the **Card (surface)** pattern above: `bg-surface border border-border rounded-2xl p-6 shadow-card`. Elevation is `shadow-card` — never inline arbitrary shadow classes. `rounded-2xl` for cards, `rounded-md` for controls.

## Focus State Standard

Interactive controls use `focus:outline-none focus:ring-1 focus:ring-accent` (1px accent ring). Do not use `ring-2` or non-accent ring colors.

## Font Standard

Only Inter is used throughout, imported via `next/font/google` in the root layout. No secondary display fonts (e.g. Playfair Display) — use font-weight and italic styling for emphasis instead.
