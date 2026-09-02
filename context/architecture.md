# Architecture

## Stack

| Layer                          | Tool                     | Purpose                                          |
| ------------------------------ | ------------------------ | ------------------------------------------------ |
| Framework                      | Next.js 16 (App Router)  | Full stack framework                             |
| Auth + DB + Storage + Realtime | InsForge                 | Entire backend                                   |
| Cloud browser                  | Browserbase              | Company research — browsing company public pages |
| AI browser control             | Stagehand                | Company page interaction and content extraction  |
| Job Discovery                  | Adzuna API               | Job search and discovery                         |
| AI model gateway               | InsForge AI (OpenRouter) | Matching, research synthesis, extraction         |
| Analytics                      | PostHog                  | Event tracking and dashboard charts              |
| PDF generation                 | @react-pdf/renderer      | Resume PDF rendering                             |
| Styling                        | Tailwind CSS + shadcn/ui | UI components and styling                        |
| Language                       | TypeScript strict        | Throughout                                       |

---

## Folder Structure

```
/
├── AGENTS.md
├── instrumentation-client.ts               → PostHog browser init (Next.js 15.3+ client instrumentation)
├── context/
│   ├── project-overview.md
│   ├── architecture.md
│   ├── ui-tokens.md
│   ├── ui-rules.md
│   ├── ui-registry.md
│   ├── code-standards.md
│   ├── library-docs.md
│   ├── build-plan.md
│   └── progress-tracker.md
├── app/
│   ├── layout.tsx                          → Root layout
│   ├── page.tsx                            → Homepage
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx                   → Login page (client, Suspense-wrapped)
│   │   └── callback/
│   │       └── route.ts                   → OAuth code exchange (Route Handler)
│   ├── (app)/
│   │   ├── layout.tsx                     → Authed layout — Navbar + main + Footer
│   │   ├── dashboard/
│   │   │   └── page.tsx                   → Main dashboard
│   │   ├── profile/
│   │   │   └── page.tsx                   → Profile form + resume management
│   │   └── find-jobs/
│   │       ├── page.tsx                   → Find Jobs page — search controls + jobs list
│   │       └── [id]/
│   │           └── page.tsx               → Individual job details page
│   └── api/
│       ├── agent/
│       │   ├── find/route.ts              → Trigger Adzuna job discovery
│       │   └── research/route.ts          → Trigger company research agent
│       ├── resume/
│       │   ├── generate/
│       │   │   ├── route.ts               → Generate resume PDF from saved profile
│       │   │   ├── resume-document.tsx    → PDF layout + renderResumePdf (server-only)
│       │   │   └── fonts/                 → Inter Regular/SemiBold TTFs (see note)
│       │   └── extract/route.ts           → Extract profile data from uploaded resume PDF (InsForge AI gateway, native PDF input)
├── agent/
│   ├── adzuna.ts                          → Adzuna API job discovery + AI gateway scoring
│   ├── research.ts                        → Company research — Browserbase + Stagehand + AI gateway
│   ├── matcher.ts                         → Job matching logic (InsForge AI gateway)
│   ├── extractor.ts                       → Job description extraction + structuring (AI gateway)
│   └── types.ts                           → Agent-specific TypeScript types
├── actions/
│   ├── auth.ts                            → signInWithOAuthAction, signOutAction
│   ├── profile.ts                         → Profile save + update
│   └── jobs.ts                            → Job status updates
├── db/
│   └── migrations/
│       └── 001_initial_schema.sql         → InsForge schema (source of truth, applied via MCP run-raw-sql)
├── components/
│   ├── ui/                                → shadcn/ui components only
│   ├── PostHogIdentify.tsx                → Client-side posthog.identify() for authed users
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── NavbarNav.tsx
│   │   ├── LogoutButton.tsx
│   │   └── Footer.tsx
│   ├── homepage/
│   │   ├── Hero.tsx
│   │   ├── HowItWorks.tsx
│   │   └── Features.tsx
│   ├── dashboard/
│   │   ├── StatsBar.tsx
│   │   ├── RecentActivity.tsx
│   │   └── AnalyticsCharts.tsx
│   ├── profile/
│   │   ├── ProfileForm.tsx
│   │   ├── ResumeUpload.tsx
│   │   ├── ResumePreview.tsx            → PLANNED, still unbuilt (see note below)
│   │   └── CompletionIndicator.tsx
│   ├── find-jobs/
│   │   ├── SearchControls.tsx
│   │   ├── JobsTable.tsx              → CONTAINER: owns list view state (see note below)
│   │   ├── JobFilters.tsx             → presentational; props + callbacks only
│   │   └── JobsPagination.tsx         → presentational; props + callbacks only
│   └── job-details/
│       ├── JobInfo.tsx
│       ├── MatchScore.tsx
│       ├── JobDescription.tsx
│       ├── CompanyResearch.tsx
│       └── JobActions.tsx
├── lib/
│   ├── insforge-client.ts                 → InsForge browser client instance
│   ├── insforge-server.ts                 → InsForge server client (30s timeout; session/DB reads)
│   ├── insforge-ai.ts                     → InsForge AI gateway client (120s timeout; AI routes only)
│   ├── browserbase.ts                     → Browserbase session creation + management
│   ├── stagehand.ts                       → Stagehand initialisation with Browserbase session
│   ├── adzuna.ts                          → Adzuna API client
│   ├── posthog-server.ts                  → PostHog server client (server-side events)
│   └── utils.ts                           → Shared utility functions
└── types/
    └── index.ts                           → Global TypeScript types
```

**`ResumePreview.tsx` is planned but still unbuilt.** Feature 06 deferred it
because nothing displayed a stored resume yet. Feature 08 was the first feature
that could have justified it and deliberately did not build it: the generated
resume's download link lives in the Resume card's existing footer row, beside
the button that produced it, and `context/designs/profile.png` shows only the
empty-state card, so no design binds the decision. Build it when a feature needs
to *display* a resume rather than link to one.

**`JobsTable.tsx` is the Find Jobs list container, not a bare table.** It owns
the list's view state — text query, match filter, sort, page — derives the
filtered/sorted/sliced rows, and composes `JobFilters` above the table card and
`JobsPagination` inside its footer; both of those are presentational. The four
files above are therefore not four peers. The state lives in `JobsTable` rather
than a fifth `JobsList.tsx` wrapper because all three components read one
derived list and this tree is the source of truth for the directory's contents.
Feature 11 moves the querying server-side: the filter rules are plain functions
over an array, so what changes is where the array comes from and where the three
values are held, not the component split.

**`app/api/resume/generate/fonts/` holds two Inter TTFs** (SIL Open Font
License), registered with `Font.register` at render time. They are not
decoration: `@react-pdf/renderer`'s built-in Helvetica is WinAnsi-only and
silently mangles Cyrillic, drops the `•` bullet marker, and drops the `—` date
separator. `next.config.ts` carries an `outputFileTracingIncludes` entry for
them — nothing imports the files, so without it the serverless bundle ships
without the fonts and fails only in production.

---

## System Boundaries

| Folder        | Owns                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| `app/`        | Pages and API routes only. No business logic.                                                          |
| `agent/`      | All agent logic. Adzuna discovery, company research, matching, extraction. Nothing here touches React. |
| `actions/`    | Server Actions for UI-triggered mutations only. Profile save, profile update.                          |
| `components/` | UI only. No data fetching logic. No direct DB calls.                                                   |
| `lib/`        | Third party client initialisation and shared utilities only.                                           |
| `types/`      | TypeScript types shared across the project.                                                            |

---

## Data Flow

### UI Mutations (Server Actions)

```
User interaction in component
        ↓
Server Action in actions/
        ↓
InsForge DB write
        ↓
Revalidate or redirect
```

### Agent Operations (API Routes)

```
User clicks Find Jobs
        ↓
API route in app/api/agent/find
        ↓
Calls agent/adzuna.ts
        ↓
Adzuna API returns job listings
        ↓
InsForge AI gateway scores each job against user profile
        ↓
Agent writes results to InsForge DB
        ↓
Page data revalidated
```

### Company Research (API Routes)

```
User clicks Research Company on job details page
        ↓
API route in app/api/agent/research
        ↓
Calls agent/research.ts
        ↓
Single Browserbase session opens with Stagehand
        ↓
Navigates to company homepage + sub pages
        ↓
InsForge AI gateway synthesizes dossier from extracted content
        ↓
Dossier saved to jobs.company_research
        ↓
Page data revalidated
```

### Resume Operations (API Routes)

```
Upload (Feature 06)                Generate (Feature 08)
uploadResume server action         POST /api/resume/generate
        ↓                                   ↓
PDF -> resumes/{uid}/resume.pdf    Reads saved profile; refuses if incomplete
        ↓                                   ↓
resume_pdf_url/key saved           InsForge AI gateway rewrites prose only
                                            ↓
                                   @react-pdf/renderer -> Buffer -> File
                                            ↓
                                   resumes/{uid}/generated-resume.pdf
                                            ↓
                                   generated_resume_url/key saved
                                            ↓
                                   Short-lived signed URL returned to browser

The two paths never touch each other’s object or columns.
```

---

## InsForge Database Schema

> **Note:** In the actual schema (`db/migrations/001_initial_schema.sql`), `user_id` columns reference `auth.users(id)` directly rather than `profiles(id)` — the values are identical (`profiles.id` = `auth.users.id`), but this avoids requiring a profiles row to exist before the first agent run. `profiles.id` references `auth.users(id) ON DELETE CASCADE`.

### `profiles`

| Column              | Type        | Notes                                        |
| ------------------- | ----------- | -------------------------------------------- |
| id                  | uuid        | References auth.users                        |
| full_name           | text        |                                              |
| email               | text        | Pre-filled from auth                         |
| phone               | text        |                                              |
| location            | text        | City, country                                |
| current_title       | text        | Most recent job title                        |
| experience_level    | text        | junior / mid / senior / lead                 |
| years_experience    | integer     |                                              |
| skills              | text[]      | Array of skill tags                          |
| industries          | text[]      | Industries worked in                         |
| work_experience     | jsonb       | Array of up to 3 roles                       |
| education           | jsonb       | Degree, field, institution, year             |
| job_titles_seeking  | text[]      | Roles they want                              |
| remote_preference   | text        | remote / onsite / hybrid / any               |
| preferred_locations | text[]      | Optional preferred locations                 |
| salary_expectation  | text        | Optional                                     |
| cover_letter_tone   | text        | formal / casual / enthusiastic               |
| linkedin_url        | text        |                                              |
| portfolio_url       | text        |                                              |
| work_authorization  | text        | citizen / permanent_resident / visa_required |
| resume_pdf_url      | text        | Storage URL of the resume the user UPLOADED  |
| resume_pdf_key      | text        | Storage key of the uploaded resume           |
| generated_resume_url | text       | Storage URL of the app-GENERATED resume      |
| generated_resume_key | text       | Storage key of the generated resume          |
| is_complete         | boolean     | True when all required fields filled         |
| created_at          | timestamptz |                                              |
| updated_at          | timestamptz |                                              |

### `agent_runs`

| Column             | Type        | Notes                        |
| ------------------ | ----------- | ---------------------------- |
| id                 | uuid        |                              |
| user_id            | uuid        | References profiles          |
| status             | text        | running / completed / failed |
| job_title_searched | text        |                              |
| location_searched  | text        |                              |
| jobs_found         | integer     | Total jobs discovered        |
| started_at         | timestamptz |                              |
| completed_at       | timestamptz |                              |

### `jobs`

| Column             | Type        | Notes                                          |
| ------------------ | ----------- | ---------------------------------------------- |
| id                 | uuid        |                                                |
| run_id             | uuid        | References agent_runs — null if from URL input |
| user_id            | uuid        | References profiles                            |
| source             | text        | search / url                                   |
| source_url         | text        | Original job listing URL                       |
| external_apply_url | text        | Direct company apply URL                       |
| title              | text        |                                                |
| company            | text        |                                                |
| location           | text        |                                                |
| salary             | text        | If available                                   |
| job_type           | text        | fulltime / parttime / contract                 |
| about_role         | text        | 2-3 sentence summary                           |
| responsibilities   | text[]      | Bullet points                                  |
| requirements       | text[]      | Bullet points                                  |
| nice_to_have       | text[]      | Optional                                       |
| benefits           | text[]      | Optional                                       |
| about_company      | text        | Brief company description                      |
| match_score        | integer     | 0-100 scored against main profile              |
| match_reason       | text        | Model's explanation                            |
| matched_skills     | text[]      | Skills user has that match                     |
| missing_skills     | text[]      | Skills user lacks                              |
| company_research   | jsonb       | Company dossier from research agent            |
| found_at           | timestamptz |                                                |

### `agent_logs`

| Column     | Type        | Notes                            |
| ---------- | ----------- | -------------------------------- |
| id         | uuid        |                                  |
| run_id     | uuid        | References agent_runs            |
| user_id    | uuid        | References profiles              |
| message    | text        | Human readable log entry         |
| level      | text        | info / success / warning / error |
| job_id     | uuid        | Optional — related job           |
| created_at | timestamptz |                                  |

### `ai_usage`

One row per **billed** InsForge AI gateway call. Backs the per-user rate limit in
`lib/ai-rate-limit.ts`; SQL in `db/migrations/004_add_ai_usage.sql`.

| Column     | Type        | Notes                                            |
| ---------- | ----------- | ------------------------------------------------ |
| id         | uuid        |                                                  |
| user_id    | uuid        | References auth.users, ON DELETE CASCADE         |
| route      | text        | Route key — `AI_ROUTE` in `lib/ai-rate-limit.ts` |
| created_at | timestamptz | Rolling-window anchor                            |

`route` has **no CHECK constraint**, unlike the other enum-ish columns in this
schema: Features 10 and 13 add AI routes of their own, and a CHECK would make
every one of them a migration. The closed set lives in TypeScript.

RLS: select-own and insert-own only. **No update and no delete policy** — a limit
a user can clear is not a limit. Rows outlive their window and nothing prunes
them; the cleanup statement is in the migration, for a scheduled job when one
exists.

---

## InsForge Storage

| Bucket  | Path                                   | Contents                          |
| ------- | -------------------------------------- | --------------------------------- |
| resumes | resumes/{user_id}/resume.pdf           | The resume the user uploaded      |
| resumes | resumes/{user_id}/generated-resume.pdf | The resume the app generated      |

Access: authenticated users only, own files only. The bucket is **private** —
the stored urls are records, not fetchable links; reads go through a
short-lived signed URL.

**These are two separate objects on purpose.** `resume_pdf_key` is what
Feature 07 extraction reads, so writing a generated resume over it would
destroy the user’s source CV and make extraction re-read the model’s own
output. `context/build-plan.md` Feature 08 says to upsert over
`resume.pdf`; that instruction predates Feature 07 and is superseded.

---

## Authentication

- Provider: InsForge Auth
- Methods: Google OAuth, GitHub OAuth
- Protected routes: /dashboard, /profile, /find-jobs, /find-jobs/[id]
- Public routes: /, /login
- Proxy in `proxy.ts` (Next.js 16 renamed `middleware` → `proxy`) checks session on every protected route via `updateSession` from `@insforge/sdk/ssr`
- On login → redirect to /dashboard

---

## InsForge Client Pattern

Three separate InsForge entry points — pick the right one for the job.

```typescript
// lib/insforge-client.ts
// Browser-side — used in client components for interactive auth flows and DB reads
import { createBrowserClient } from "@insforge/sdk/ssr";
export const insforge = createBrowserClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
  anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
});

// lib/insforge-server.ts
// Server-side READ-ONLY — used in Server Components / actions / route handlers
// when you only need to *read* the current user or query the DB.
// ⚠️ Does NOT write cookies — cannot sign in, sign out, or exchange OAuth codes.
import { createServerClient } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";

export const createInsforgeServer = async () => {
  const cookieStore = await cookies();
  return createServerClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
    cookies: cookieStore,
  });
};

// Cookie-writing auth (sign-in / sign-out / OAuth code exchange)
// Use `createAuthActions` inline inside a Server Action or Route Handler.
import { createAuthActions } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";

async function signOut() {
  const cookieStore = await cookies();
  const authActions = createAuthActions({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
    cookies: cookieStore, // full read/write cookie store
  });
  await authActions.signOut();
}
```

---

## Browserbase Session Pattern

```typescript
// Company research session — single session, sequential page visits
const session = await bb.sessions.create({
  projectId: process.env.BROWSERBASE_PROJECT_ID!,
  timeout: 120, // 2 minute session — visits 3-4 pages max
});
```

---

## Job Discovery Pattern

**Adzuna API — job search**

```typescript
const response = await fetch(
  `https://api.adzuna.com/v1/api/jobs/us/search/1?` +
    `app_id=${process.env.ADZUNA_APP_ID}&` +
    `app_key=${process.env.ADZUNA_APP_KEY}&` +
    `what=${encodeURIComponent(jobTitle)}&` +
    `where=${encodeURIComponent(location)}&` +
    `category=it-jobs&` +
    `results_per_page=10&` +
    `content-type=application/json`,
);
const data = await response.json();
// data.results — array of job listings
// Each job: title, company.display_name, location.display_name,
//           salary_min, salary_max, description, redirect_url, created
```

---

## Company Research Pattern

> **UNRESOLVED — settle this before Feature 13 writes any code.** The model
> configuration below used to name `gpt-4o` and `process.env.OPENAI_API_KEY`,
> neither of which exists in this project: `code-standards.md` states there is
> no `openai` package and no `OPENAI_API_KEY`, because every model call goes
> through the InsForge AI gateway (Feature 07). Stagehand constructs its own LLM
> client, so it cannot call `insforge.ai.chat.completions.create` the way the
> AI routes do — which means the mechanism is a real open decision, not a
> copy-paste detail. Settle it in `/opsx-propose` for Feature 13; the likely
> route is pointing Stagehand's OpenAI-compatible client at a gateway base URL.
> Until then the fields are placeholders on purpose. **Do not reintroduce
> `OPENAI_API_KEY`.**

```typescript
// Single session — visits company homepage and sub pages sequentially
const stagehand = new Stagehand({
  env: "BROWSERBASE",
  apiKey: process.env.BROWSERBASE_API_KEY!,
  projectId: process.env.BROWSERBASE_PROJECT_ID!,
  browserbaseSessionID: session.id,
  // UNRESOLVED — see the note above. This project has no OPENAI_API_KEY.
  modelName: "<settle in Feature 13>",
  modelClientOptions: { /* gateway-backed client — mechanism undecided */ },
});

await stagehand.init();
const page = stagehand.page;

// Clean company name and construct homepage URL
const cleanName = companyName
  .replace(/\s*(Inc\.?|LLC|Ltd\.?|Corp\.?|Co\.?).*$/i, "")
  .trim()
  .toLowerCase()
  .replace(/\s+/g, "");

const homepageUrl = `https://www.${cleanName}.com`;

// Navigate and extract — graceful fallback if page not found
try {
  await page.goto(homepageUrl);
  await page.waitForLoadState("networkidle");
  const content = await stagehand.extract({ instruction: "..." });
} catch (error) {
  // Log and continue — synthesis runs on whatever was found
  await logAgentError(jobId, error);
}

// Always close session when done
await stagehand.close();
```

---

## Invariants

Rules the AI agent must never violate:

- API routes contain no UI logic. Components contain no DB logic.
- Agent code in `/agent` never imports from `/components` or `/actions`.
- Server Actions never call agent functions. Agent functions are only called from API routes.
- All InsForge server-side writes use `createInsforgeServer()` — never the browser client.
- No hardcoded hex values or raw Tailwind color classes in components — use CSS variables from ui-tokens.md.
- Every Stagehand action is wrapped in try/catch. Failures are logged to agent_logs, never thrown to crash the run.
- Company research always returns a dossier — even if browser research fails, the AI gateway synthesizes from company name and job description alone. Never return empty.
- Browserbase sessions are always closed with stagehand.close() when done — never leave sessions open.
- Always scope InsForge queries to the current user_id — never query without a user filter.
- Adzuna API always includes category=it-jobs — never search without this filter.
- jobs.source is always 'search' or 'url' — never any other value.
