# Code Standards

Implementation rules and conventions for the entire project. The AI agent must follow these in every session without exception. These rules prevent pattern drift across sessions.

---

## Engineering Mindset

The AI agent on this project operates as a senior engineer. This means:

- **Think before implementing** — understand what is being built and why before writing a single line
- **Read context files first** — never assume, always verify against architecture.md and project-overview.md
- **Scope is sacred** — only build what the current feature requires. Never go beyond scope even if it seems helpful
- **Every feature must be testable** — if it cannot be verified immediately after implementation, it is incomplete
- **Clean over clever** — simple readable code that a junior developer can understand is always preferred over clever abstractions
- **One thing at a time** — complete one feature fully before touching the next
- **Failures are expected** — wrap agent operations in try/catch, log failures, never let one failure crash everything

---

## TypeScript

- Strict mode enabled in tsconfig.json — no exceptions
- Never use `any` — use `unknown` and narrow the type
- Never use type assertions (`as SomeType`) unless absolutely necessary and commented why
- All function parameters and return types must be explicitly typed
- Use `type` for object shapes and unions — use `interface` only for extendable component props
- All async functions must have proper error handling — never let promises float unhandled
- Use `const` by default — only use `let` when reassignment is necessary

---

## Next.js 16 Conventions

- App Router only — no Pages Router
- React 19 — use React 19 APIs throughout
- All components are Server Components by default
- Only add `"use client"` when the component requires:
  - useState or useReducer
  - useEffect
  - Browser APIs
  - Event listeners
  - Third party client-only libraries (PostHog browser side)
- Never add `"use client"` to layout files unless absolutely required
- Data fetching happens in Server Components — never fetch in Client Components directly
- Route handlers live in `app/api/` — never put business logic directly in route handlers
- Server Actions live in `actions/` — never define Server Actions inline in components
- Caching is uncached by default — all dynamic code runs at request time
- Always read Next.js documentation before implementing any Next.js specific feature — APIs may differ from training data

---

## File and Folder Naming

- Folders: kebab-case — `job-details`, `agent-controls`
- Component files: PascalCase — `StatsBar.tsx`, `RecentActivity.tsx`
- Utility files: camelCase — `browserbase.ts`, `posthog-client.ts`
- Type files: camelCase — `index.ts`
- API route files: always `route.ts`
- Server Action files: camelCase — `profile.ts`, `jobs.ts`
- One component per file — never export multiple components from one file
- Index files only in `components/ui/` — never barrel export from other folders

---

## Component Structure

Every component follows this exact order:

```typescript
"use client"; // only if needed

// 1. External imports
import { useState } from "react";
import { Button } from "@/components/ui/button";

// 2. Internal imports
import { StatsCard } from "@/components/dashboard/StatsCard";

// 3. Type definitions
type Props = {
  jobId: string;
  matchScore: number;
};

// 4. Component
export function ComponentName({ jobId, matchScore }: Props) {
  // state
  // derived values
  // handlers
  // return JSX
}
```

- Never use default exports for components — always named exports
- Props type defined directly above the component — not in a separate types file unless shared
- No inline styles — all styling via Tailwind classes using CSS variables from ui-tokens.md

---

## API Route Handlers

```typescript
// app/api/agent/find/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createInsforgeServer } from "@/lib/insforge-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // validate body
    // call agent function
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[api/agent/find]", error);
    return fail(SERVICE_ERROR);
  }
}
```

**Failures return HTTP 200 with `{ success: false, error }`, not a non-2xx.**
Every shipped route does this through a local `fail()` helper, and every client
checks `result.success` rather than `response.ok`. A bare non-2xx with an HTML
body makes `response.json()` throw, and the user gets a generic fallback instead
of the specific message the server wrote. Hoist user-facing strings to module
constants (`AUTH_ERROR`, `SERVICE_ERROR`, `RATE_LIMIT_ERROR`) so they can be
read in one place.

- Every route handler has a try/catch
- Every route handler validates the request body before processing
- Errors are logged with the route path as prefix: `[agent/find]`
- Always return `{ success: boolean, data?: T, error?: string }`
- Never return raw data without the success wrapper

### Routes that call the AI gateway

Three things are **mandatory**, and each of them has already cost this project a
real bug or a real risk:

1. **`export const maxDuration`**, at least `AI_TIMEOUT_MS` (`lib/insforge-ai.ts`).
   Without it the route inherits the platform default (10s on Vercel Hobby) and
   dies in production while passing every local test, because dev has no limit.
2. **A rate-limit check.** Add a key to `AI_ROUTE` and a limit to `LIMITS` in
   `lib/ai-rate-limit.ts`, then call `checkAiRateLimit` before the first model
   call and `recordAiCall` immediately before it. Place the check *after* the
   free failure cases — a user with no resume should get "upload a resume", not
   "too many requests". Client-side `useRef` guards stop a double click; they do
   not stop a `for` loop against the endpoint, and every call is billed.
3. **A synchronous in-flight guard in the UI** — a `useRef`, not just
   `disabled`. `setState` lands a render later, so two clicks in one tick both
   read the old value and both fire. This was measured: a double click sent two
   POSTs and two billed calls.

Model choice is a measurement, not a preference: benchmark candidates on real
input and record the numbers in a comment above the constant (see
`EXTRACTION_MODEL` and `GENERATION_MODEL`). Cap output with `maxTokens` —
output is the dominant cost.

---

## Server Actions

```typescript
// actions/profile.ts

"use server";

import { revalidatePath } from "next/cache";
import { createInsforgeServer } from "@/lib/insforge-server";

export async function saveProfile(formData: ProfileFormData) {
  try {
    const insforge = await createInsforgeServer();
    // validate
    // write to DB
    revalidatePath("/profile");
    return { success: true };
  } catch (error) {
    console.error("[actions/profile]", error);
    return { success: false, error: "Failed to save profile" };
  }
}
```

- Every Server Action has a try/catch
- Every Server Action returns `{ success: boolean, error?: string }`
- Always call `revalidatePath` after mutations that affect page data
- Never throw from Server Actions — always return the error

---

## Agent Code

```typescript
// agent/adzuna.ts

export async function discoverJobs(
  jobTitle: string,
  location: string,
  profile: Profile,
  runId: string,
): Promise<{ success: boolean; jobs?: Job[]; error?: string }> {
  try {
    // implementation
    return { success: true, jobs };
  } catch (error) {
    await logAgentError(runId, null, error);
    return { success: false, error: String(error) };
  }
}
```

- Every agent function returns `{ success: boolean, error?: string }`
- Every agent function has a try/catch — never let one failure crash the run
- Errors are always logged to agent_logs table before returning
- Agent functions never import from `components/` or `actions/`
- Agent functions never use React hooks or browser APIs

---

## InsForge Client Usage

```typescript
// Browser context — Client Components only
import { insforge } from "@/lib/insforge-client";

// Server context — Server Components, Route Handlers, Server Actions, Agent
import { createInsforgeServer } from "@/lib/insforge-server";
const insforge = await createInsforgeServer();
```

- Never use the browser client in server context
- Never use the server client in browser context
- Always await createInsforgeServer() — it reads cookies asynchronously
- Always scope every query to the current user_id — never query without a user filter

---

## Error Handling

- Never use empty catch blocks — always log or handle
- Console errors always include context prefix: `[component/function name]`
- User-facing errors must be human readable — never expose raw error messages
- Agent errors go to agent_logs table — never surface raw agent errors to the UI
- API route errors return `status: 500` with generic message — never expose internals

---

## PostHog Events

All PostHog events must use these exact event names. Never invent new event names without adding them here first.

| Event                | When                                       | Key Properties             |
| -------------------- | ------------------------------------------ | -------------------------- |
| `job_search_started` | Find Jobs button clicked                   | userId, jobTitle, location |
| `job_found`          | Each job discovered and saved              | userId, source, matchScore |
| `profile_completed`  | User saves complete profile for first time | userId                     |
| `company_researched` | Company research dossier generated         | userId, jobId, company     |

These four events are the only events in this project. Do not add more without updating this list first.

`job_found` powers the Jobs Found Over Time and Match Score Distribution dashboard charts.
`company_researched` powers the Company Research Activity dashboard chart.
Always fire these with correct properties.

**Wiring order:** these are product events tied to features that do not exist yet — each is added only when its owning feature is built (`job_search_started` / `job_found` with Adzuna discovery, `profile_completed` with the profile page, `company_researched` with the research agent). Do not add any of them ahead of its feature.

**Initialization vs. events:** PostHog client initialization (autocapture + pageviews) lives in `instrumentation-client.ts`; the server client lives in `lib/posthog-server.ts`. Identification is client-side only — `posthog.identify(userId)` via `components/PostHogIdentify.tsx` (rendered in the authed layout) and `posthog.reset()` on logout via `components/layout/LogoutButton.tsx`. Do NOT add bespoke auth capture events (e.g. `sign_in_completed`, `sign_out`); autocapture and identification cover the auth funnel until a documented event says otherwise.

---

## Environment Variables

All environment variables defined in `.env.local` for development. Never hardcode any key, URL, or secret anywhere in the codebase.

| Variable                        | Used In                |
| ------------------------------- | ---------------------- |
| `NEXT_PUBLIC_INSFORGE_URL`      | lib/insforge-client.ts |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | lib/insforge-client.ts |
| `BROWSERBASE_API_KEY`           | lib/browserbase.ts     |
| `BROWSERBASE_PROJECT_ID`        | lib/browserbase.ts     |
| `ADZUNA_APP_ID`                 | agent/adzuna.ts, via `serverEnv()` |
| `ADZUNA_APP_KEY`                | agent/adzuna.ts, via `serverEnv()` |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | instrumentation-client.ts, lib/posthog-server.ts |
| `NEXT_PUBLIC_POSTHOG_HOST`          | lib/posthog-server.ts (server flush host)         |

`NEXT_PUBLIC_` prefix means the variable is exposed to the browser. Never add `NEXT_PUBLIC_` to secret keys.

Required env vars are validated once at boot in `lib/env.ts` (zod schema) and exported as the typed `env` constant. Import from `@/lib/env` and read `env.X` — never `process.env.X!`. Add a new required var to the `lib/env.ts` schema when the feature that needs it is built. Optional integrations that degrade gracefully when unset (e.g. the PostHog token) are read directly at their use site and must NOT be added to the schema.

---

## Match Threshold

The job match threshold is defined once as a constant. Never hardcode this value anywhere else.

```typescript
// lib/utils.ts
export const MATCH_THRESHOLD = 70;
```

Import and use `MATCH_THRESHOLD` everywhere this value is needed.

---

## Import Aliases

Always use the `@/` alias — never use relative imports that go up more than one level.

```typescript
// Correct
import { Button } from "@/components/ui/button";
import { insforge } from "@/lib/insforge-client";
import { MATCH_THRESHOLD } from "@/lib/utils";

// Never
import { Button } from "../../../components/ui/button";
```

---

## Comments

- No comments explaining what the code does — code must be self-explanatory
- Comments only for why — explaining a non-obvious decision
- Agent functions may have a brief comment explaining the Browserbase or Stagehand strategy
- Never leave TODO comments in committed code

---

## Dependencies

Never install a new package without a clear reason. Before installing anything check:

1. Does shadcn/ui already have this component?
2. Does Next.js already provide this functionality?
3. Is there a simpler native solution?

Approved dependencies for this project:

- `@insforge/sdk` — InsForge client (SSR helpers under `@insforge/sdk/ssr`)
- `@browserbasehq/sdk` — Browserbase sessions
- `@browserbasehq/stagehand` — AI browser control
- AI models — via `insforge.ai.chat.completions.create` (InsForge AI gateway). No `openai` package and no `OPENAI_API_KEY`.
- Rate limiting for AI routes — `lib/ai-rate-limit.ts`. **Mandatory on every route that calls the gateway** (see the rule below).
- `posthog-js` — PostHog browser client
- `posthog-node` — PostHog server client
- `@react-pdf/renderer` — Resume PDF generation
- PDF reading — send the PDF to the gateway as a `file` part with `fileParser`. No `pdf-parse`.
- `zod` — Schema validation
- `lucide-react` — Icons
- `tailwindcss` — Styling
- `shadcn/ui` components — UI primitives

Do not install any other packages without updating this list first.
