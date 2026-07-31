# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A developer or technical job seeker who is actively applying to jobs, has an existing resume, and wants intelligent job matching against their actual skills plus fast company research before applying. Comfortable with modern web applications.

The audience that actually evaluates this build is secondary but real: people reviewing it as a portfolio piece (see Positioning).

## Product Purpose

JobPilot is a full-stack AI-powered job hunting assistant. The user sets up a profile once, uploads a resume, and the agent discovers relevant jobs from Adzuna, scores each 0–100 against the profile using GPT-4o, and — on demand — researches the company across its public web pages into a structured dossier (overview, tech stack, culture, why the role exists, interview prep). The user reviews everything and applies with one click; the whole process is tracked on a dashboard with PostHog-powered analytics.

Success: a user can sign up, complete their profile, upload a resume, and start finding scored jobs in under 5 minutes, arriving at every application fully informed.

## Positioning

**This is a portfolio/demo project**, built to showcase AI-agent full-stack engineering skills — not a commercial product with real users. The product mechanism it demonstrates: an agent pipeline (Adzuna discovery → GPT-4o profile-aware scoring with matched/missing skills → Browserbase + Stagehand company research synthesized by GPT-4o) that eliminates job-hunt preparation work rather than just listing jobs.

## Operating Context

- Job discovery is manually triggered from the Find Jobs page (title + location search); no scheduled agent runs.
- Company research is per-job, on demand, via a single Browserbase session with Stagehand; falls back to a GPT-4o-only dossier when the company site can't be found.
- One active resume per user; profile data lives in `profiles` and is never modified by agent operations. Company research lives in `jobs.company_research` and never affects profile or score.
- Backend is InsForge (PostgreSQL + RLS, auth via Google/GitHub OAuth, private `resumes` storage bucket). Analytics via PostHog (events + dashboard charts).
- "Jobs by Adzuna" credit must appear on all job listings.

## Capabilities and Constraints

In scope: homepage, auth, profile form with resume PDF upload / GPT-4o extraction / PDF generation, Adzuna discovery (IT category), GPT-4o match scoring with reasons and skill tags, job details page, company research agent, Find Jobs page with filter/sort/pagination, dashboard with stats, recent activity, and PostHog charts.

Explicitly out of scope (do not design for these): auto-apply, cover letter generation, resume tailoring, dismiss-job, notifications, mobile app, team/multi-user accounts, payments, browser extension, sidebar navigation (top navbar only), separate analytics page.

Build state: phased build tracked in `context/progress-tracker.md`; Phase 1 (homepage, auth, PostHog init, DB schema) is complete. `context/` docs (`architecture.md`, `code-standards.md`, `build-plan.md`) are binding technical authority.

## Brand Commitments

- Name: **JobPilot**. Logo asset at `app/logo.png`.
- Voice: neutral-professional. No pilot/flight metaphor commitment — do not lean into it.
- The user has made the existing token system binding: design tokens in `context/ui-tokens.md` and rules in `context/ui-rules.md` (including the Inter-only font invariant and the no-raw-color-classes rule) govern all UI work.

## Evidence on Hand

**None.** No real users, testimonials, metrics, case studies, or press exist. The testimonial-style section on the homepage is placeholder content. Future surfaces must not fabricate testimonials, user counts, customer logos, benchmarks, or pricing/plan claims. Truthful framing (what the agent pipeline does, how it works) is the only available proof.

## Product Principles

1. **The agent prepares; the human decides.** Every automation ends at a human review point — scores, dossiers, and generated resumes inform the user's one-click decision, never act for them.
2. **Profile data is sacred.** Only explicit user edits or an explicit "Extract from Resume" change the profile; no agent operation touches it.
3. **Show the reasoning, not just the result.** Match scores come with reasons and matched/missing skills; research comes as a structured, sourced dossier.
4. **Honest by construction.** As a portfolio piece with no real traction, every claim on every surface must be true of the software itself.
5. **Low-scoring results stay visible.** The agent filters nothing away; it ranks and highlights, and the user decides what to pursue.
