---
name: JobPilot
description: Calm, light SaaS interface — white cards on a cool tinted ground, one purple voice.
colors:
  background: "#f6f7fb"
  surface: "#ffffff"
  surface-secondary: "#f9fafb"
  surface-tertiary: "#f2f5f7"
  surface-muted: "#f4f5fb"
  border: "#e7eaf3"
  border-light: "#e5e7eb"
  border-muted: "#dfe1e7"
  text-primary: "#101828"
  text-secondary: "#6a7282"
  text-muted: "#99a1af"
  text-dark: "#364153"
  text-darker: "#36394a"
  text-darkest: "#111827"
  text-black: "#131316"
  text-slate: "#272835"
  text-slate-medium: "#666d80"
  accent: "#7c5cfc"
  accent-dark: "#5e4cff"
  accent-light: "#f3e8ff"
  accent-muted: "#faf5ff"
  accent-foreground: "#ffffff"
  success: "#10b981"
  success-alt: "#00bc7d"
  success-dark: "#007a55"
  success-darker: "#009966"
  success-light: "#d0fae5"
  success-lightest: "#ecfdf5"
  success-foreground: "#007a55"
  info: "#61a8ff"
  info-dark: "#155dfc"
  info-medium: "#2b7fff"
  info-light: "#dbeafe"
  info-lightest: "#eff6ff"
  info-foreground: "#155dfc"
  info-muted: "#94a2c5"
  warning: "#ff8904"
  warning-foreground: "#ffffff"
  error: "#ef4444"
  error-foreground: "#ffffff"
  linkedin: "#0a66c2"
  linkedin-light: "#dce6f1"
  linkedin-foreground: "#ffffff"
  overlay: "#111827"
  overlay-dark: "#131316"
typography:
  display:
    fontFamily: "Inter, sans-serif"
    fontSize: "56px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Inter, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "32px"
  title:
    fontFamily: "Inter, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "24px"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
  stat:
    fontFamily: "Inter, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: "36px"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-dark:
    backgroundColor: "{colors.overlay-dark}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "24px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  badge:
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
---

# Design System: JobPilot

## Overview

**Creative North Star: "The Calm Briefing"**

JobPilot's interface is the desk where everything the agent prepared is laid out neatly so the human can decide. The system is calm and trustworthy: a cool, faintly lavender-tinted ground (#F6F7FB) holds plain white cards, and almost everything on screen is quiet neutral ink. One color — Iris purple (#7C5CFC) — carries the entire brand voice: the primary action, the active nav item, the focus ring. Status colors (green, blue, orange) appear only as small, factual signals — badges, score bars, activity dots — never as decoration.

Density is comfortable, not cramped. Structure comes from hairline borders and generous card padding rather than shadows or heavy dividers. The typography is a single family (Inter) worked hard across weights: bold and tight for the one hero moment, semibold for headings and stats, medium for nearly all reading text. Nothing glows, bounces, or gradients its way into attention; the design earns trust by staying out of the way of the information.

**Key Characteristics:**

- Light-only theme: white surfaces on a cool tinted background, dark ink text
- One accent (Iris) used sparingly and always meaningfully
- Border-first structure; a single whisper-quiet card shadow
- Color lives *inside* cards (badges, bars, dots) — never on card surfaces
- Refined and restrained controls; small type sizes, confident weights

## Colors

A quiet neutral field with one purple voice and a small set of factual status hues.

### Primary

- **Iris** (#7C5CFC): the only purple and the only brand color. Primary buttons, active nav links, focus rings, match-score fills at the top range, the "Jobs Found" chart line. Also appears as **Iris Deep** (#5E4CFF) for gradient logo work, **Iris Wash** (#F3E8FF) for light badge backgrounds, and **Iris Mist** (#FAF5FF) for the subtlest tinted fills.

### Neutral

- **Cloud Field** (#F6F7FB): the page background — cool, faintly lavender, never pure gray.
- **Paper** (#FFFFFF): every card and control surface. Cards are always white.
- **Whisper Gray** (#F9FAFB): secondary surfaces — table row hover, ghost-button hover, neutral notice banners.
- **Hairline** (#E7EAF3): the default border on every card, input, and table row.
- **Ink** (#101828): headings and primary text.
- **Slate Voice** (#6A7282): secondary text, card labels, table headers.
- **Faded Ink** (#99A1AF): placeholders, timestamps, empty-state copy.
- **Night Ink** (#131316): the dark CTA button surface ("Start for Free", GitHub OAuth) and dark overlays.

### Functional

- **Meadow** (#10B981) with its light washes (#D0FAE5, #ECFDF5) and deep text tones (#007A55, #009966): high match scores, matched-skill badges, positive trend badges, the score-distribution chart.
- **Sky** (#61A8FF) with washes (#DBEAFE, #EFF6FF) and deep text (#155DFC): informational accents, activity chart bars.
- **Amber Signal** (#FF8904): mid-range match scores only.
- **Alert Red** (#EF4444): errors only.
- **LinkedIn Blue** (#0A66C2 on #DCE6F1): reserved exclusively for the LinkedIn source badge.

### Named Rules

**The One Purple Rule.** Iris (#7C5CFC) is the only purple in the system. Never use Tailwind's built-in purple scale or any second purple.

**The Color-Inside Rule.** Card surfaces are always white. Color enters a card only through its contents — badges, score bars, dots, chart marks, text — never through the card background.

**The Token Gate.** No raw hex values and no built-in Tailwind color classes (`bg-purple-500`, `text-gray-600`) in components. Every color goes through a `@theme` token in `app/globals.css`.

## Typography

**Display/Body Font:** Inter (sans-serif fallback), loaded via `next/font/google`

**Character:** One family carrying the whole interface through weight alone — bold and tightly tracked for the single hero moment, semibold for structure, medium for content. Small sizes, high legibility, zero typographic theater.

### Hierarchy

- **Display** (700, 36→48→56px responsive, leading-tight, -0.025em): hero headline on the homepage only.
- **Headline** (600, 24px / 32px): page-level headings (login card, dashboard title).
- **Stat** (600, 30px / 36px): dashboard stat-card numbers — the largest recurring number on screen.
- **Title** (600, 16px / 24px): card and section headings.
- **Body** (500, 14px / 20px): nearly all content — nav items, table rows, activity text, buttons.
- **Label** (500, 12px / 16px): badges, trend chips, uppercase table column headers.
- **Muted** (400, 12px / 16px): timestamps, stat subtitles, placeholders, chart axis labels.

### Named Rules

**The Inter-Only Rule.** No secondary or display typeface, ever. Emphasis is achieved with weight and italics, not new fonts.

**The One-Weight Rule.** Never mix font weights inside a single UI element.

## Layout

Full-width top-navbar application; no sidebar, no drawer. Content sits in a centered 1440px max-width container with 32px padding on all sides (`px-8 py-8`). The header is 64px tall, white, full viewport width. Page sections stack with 24px gaps; the spacing rhythm is a 4px base scale (4 / 8 / 12 / 16 / 24 / 32) where 16px is internal card spacing, 24px separates sections, and 32px separates page-level regions. Everything stays in normal document flow — nothing is `position: fixed`.

The homepage (Persuade surface) allows one atmospheric gesture: giant blurred color orbs (`accent-light` and `info-light` at 50% opacity, 96px blur) floating behind the hero. This treatment stays on marketing surfaces and never enters the app.

## Elevation & Depth

Border-first. Structure and separation come from 1px Hairline (#E7EAF3) borders; the background tint does the rest. There is exactly one shadow in the system — **shadow-card** (`0 1px 3px rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)`) — and its role is ambient: a barely-there lift under white cards so they read as paper on the desk, not floating panels.

### Shadow Vocabulary

- **shadow-card** (`box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)`): the only shadow. Applied to cards via the token, never as an inline arbitrary value.

### Named Rules

**The One-Shadow Rule.** `shadow-card` is the entire shadow vocabulary. No hover glows, no colored shadows, no elevation ladder.

## Shapes

A two-tier radius language: **16px (`rounded-2xl`) for cards and large surfaces, 8px (`rounded-md`) for every control** — buttons, inputs, notices. Badges and score bars are full pills (9999px); trend chips on stat cards are the one deliberate exception at 4px (`rounded-sm`). Borders are 1px hairlines everywhere. Never nest more than two levels of border radius inside each other.

## Components

The controls are refined and restrained — quiet by default, with Iris appearing only where it earns its place (the primary action, the focused field, the active link).

### Buttons

- **Shape:** gently rounded (8px), 16px/8px padding (`px-4 py-2`), 14px medium text
- **Primary (Iris):** `bg-accent` with white text — the one purple action on a surface
- **Dark CTA:** `bg-overlay-dark` (#131316) with white text — navbar "Start for Free", GitHub OAuth; hover fades to 90% opacity
- **Secondary:** white surface, Hairline border, Ink text; hover to Whisper Gray
- **Ghost:** transparent, Slate Voice text, hover to Whisper Gray
- **Focus (all):** `focus:ring-1 focus:ring-accent` with outline removed; **Disabled:** 60% opacity, not-allowed cursor

### Cards / Containers

- **Corner Style:** 16px (`rounded-2xl`)
- **Background:** always Paper white
- **Border:** 1px Hairline
- **Shadow Strategy:** `shadow-card` token (see Elevation)
- **Internal Padding:** 24px (`p-6`)

### Inputs / Fields

- **Style:** white surface, 1px Hairline border, 8px radius, 12px/8px padding, 14px Ink text, Faded Ink placeholder
- **Focus:** 1px Iris ring plus Iris border

### Badges

- **Shape:** full pill, 8px/2px padding, 12px medium text
- **Matched skill:** `bg-success-lightest` / `text-success-foreground`; **Missing skill:** `bg-accent-muted` / `text-accent`
- **High match:** `bg-success-lightest` / `text-success-foreground`; **Low match:** `bg-surface-secondary` / `text-text-secondary`
- **Source — LinkedIn:** `bg-linkedin-light` / `text-linkedin`; **Source — URL:** `bg-surface-secondary` / `text-text-secondary`
- **Trend chip (stat cards):** the 4px-radius exception, `bg-success-lightest` / `text-success-darker`

### Navigation

- White full-width 64px header; logo left, three centered links (Dashboard, Find Jobs, Profile), dark CTA right
- Links are 14px medium; active state is a color change only — Iris for active, `text-text-dark` for inactive. No underlines.

### Match Score Bar (signature component)

Inline 4px-tall full-pill progress bar next to the percentage number, on a Hairline track. Fill color follows the product's High Match boundary (`match_score >= 70`): **Meadow green at 70–100, Amber Signal at 50–69, Faded Ink gray below 50.** Sky blue never appears in score bars — it belongs to informational accents and charts. Badge washes may deepen with score (`bg-success-light` at 70–89, `bg-success-lightest` at 90–100).

### Activity Dots (signature component)

8px inner dot inside a 16px tinted outer ring with a white border; each activity type keeps its pair — Iris on Iris Wash (resume events), Sky on Sky wash (info events), Meadow on Meadow wash (job found).

## Do's and Don'ts

### Do:

- **Do** route every color through a `@theme` token; the utility classes (`bg-accent`, `text-text-primary`) are the only way color enters a component.
- **Do** keep cards white with 1px Hairline borders, 16px radius, 24px padding, and the `shadow-card` token.
- **Do** use `rounded-md` (8px) and `px-4 py-2` on every button, and `focus:ring-1 focus:ring-accent` on every interactive control.
- **Do** give every empty-able section a minimal empty state: Faded Ink text, optional icon, a CTA when a next action exists.
- **Do** keep tables as white rows separated by Hairline borders with uppercase 12px column headers — no zebra striping.

### Don't:

- **Don't** use raw Tailwind color classes or inline hex values anywhere in components.
- **Don't** put gradients or colors on card backgrounds; the blurred hero orbs are a marketing-surface-only exception.
- **Don't** introduce a second font, a second purple, or a second shadow.
- **Don't** use `position: fixed`, sidebars, or drawers — top navbar and normal flow only.
- **Don't** show raw error messages; translate to human-readable text in a neutral notice banner.
