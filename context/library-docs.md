# Library Docs

Project-specific usage patterns for every third party library in this project. This file only covers how we use each library in this specific project — rules, patterns, and constraints specific to JobPilot.

Read the relevant section before implementing any feature that touches these libraries.

---

## Before Using Any Library

Before implementing any feature that uses a third party library:

1. **Check AGENTS.md** at the project root — it lists every skill installed for this project and how to use them. Skills contain up-to-date API documentation, usage patterns, and best practices specific to this codebase.

2. **Check if an MCP server is configured** for that library. Some tools have MCP servers that give the AI agent direct access to documentation, logs, and debugging tools. If an MCP server is available — use it before falling back to general knowledge.

3. **Read this file** for project-specific patterns that override general library knowledge.

The order of authority is:

```
MCP server (real-time docs) → Skills via AGENTS.md → This file (project rules) → General training knowledge
```

Never rely on general training knowledge alone for library APIs — they change frequently and training data may be outdated.

---

## InsForge

**Check first:** Check AGENTS.md for an installed InsForge skill. If an InsForge MCP server is configured — use it. The skill/MCP will have the latest API patterns.

### Client vs Server

Two separate instances — never mix them:

```typescript
// lib/insforge-client.ts — browser context only
import { createBrowserClient } from "@insforge/sdk/ssr";

export const insforge = createBrowserClient(
  process.env.NEXT_PUBLIC_INSFORGE_URL!,
  process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
);
```

```typescript
// lib/insforge-server.ts — server context only
import { createServerClient } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";

export const createInsforgeServer = async () => {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_INSFORGE_URL!,
    process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );
};
```

**Rules:**

- Browser client — Client Components, browser-side auth state, realtime subscriptions
- Server client — Server Components, API routes, Server Actions, agent functions
- Never use browser client in server context
- Never use server client in browser context

---

### Auth

```typescript
// Get current user in server context
const insforge = await createInsforgeServer();
const {
  data: { user },
  error,
} = await insforge.auth.getUser();
if (!user) redirect("/login");
```

---

### DB Queries

```typescript
// Read
const { data, error } = await insforge
  .from("jobs")
  .select("*")
  .eq("user_id", user.id)
  .order("found_at", { ascending: false });

// Insert
const { data, error } = await insforge
  .from("jobs")
  .insert({ user_id: user.id, title, company, match_score })
  .select()
  .single();

// Update
const { error } = await insforge
  .from("jobs")
  .update({ company_research: dossier })
  .eq("id", jobId)
  .eq("user_id", user.id); // always scope to user
```

**Rules:**

- Always scope queries to `user_id` — never query without user filter
- Always handle the `error` return — never assume success
- Use `.single()` when expecting exactly one row

---

### Storage

```typescript
const { data, error } = await insforge.storage
  .from("resumes")
  .upload(`${userId}/resume.pdf`, file);

if (error || !data) {
  // handle error
}

// Persist BOTH — url is for display, key is required for download/delete
await insforge.database
  .from("profiles")
  .update({
    resume_pdf_url: data.url,
    resume_pdf_key: data.key,
  })
  .eq("id", userId);
```

**Storage paths:**

- Base resume object key: `{user_id}/resume.pdf` in the `resumes` bucket
- Enforce `{user_id}/` as the first path segment on the server; reject a returned key that does not match

**Rules:**

- Do not pass `upsert: true` — the SDK replaces an existing key in place (standard PUT)
- Always persist the returned `url` and `key` on the profile row
- Never write files to disk — upload the `File` / `Blob` directly
- Path isolation is server-mediated (private bucket; prefix check on the returned key)

---

## Adzuna API

**Check first:** Check AGENTS.md for an installed Adzuna skill. If none exists — use this file and the official Adzuna API docs.

### Job Search

```typescript
// lib/adzuna.ts
export async function searchJobs(
  jobTitle: string,
  location: string,
  country: string = "us",
): Promise<AdzunaJob[]> {
  const params = new URLSearchParams({
    app_id: process.env.ADZUNA_APP_ID!,
    app_key: process.env.ADZUNA_APP_KEY!,
    what: jobTitle,
    category: "it-jobs", // always filter to IT jobs
    results_per_page: "10",
    "content-type": "application/json",
  });

  // Only add where if location is provided
  if (location) {
    params.set("where", location);
  }

  const response = await fetch(
    `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`,
  );

  if (!response.ok) {
    throw new Error(`Adzuna API error: ${response.status}`);
  }

  const data = await response.json();
  return data.results || [];
}
```

### Response Shape

Each Adzuna job result contains:

```typescript
type AdzunaJob = {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string };
  description: string; // snippet only — not full description
  redirect_url: string; // Adzuna tracking URL → redirects to actual job
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted: "0" | "1"; // "1" means salary is estimated
  contract_type?: string;
  created: string; // ISO date string
  category: { tag: string; label: string };
};
```

### Saving Jobs to DB

```typescript
// Map Adzuna result to jobs table
const jobRecord = {
  user_id: userId,
  run_id: runId,
  source: "search", // always 'search' for Adzuna jobs
  source_url: job.redirect_url,
  external_apply_url: job.redirect_url,
  title: job.title,
  company: job.company.display_name,
  location: job.location.display_name,
  salary: job.salary_min
    ? `$${Math.round(job.salary_min / 1000)}k - $${Math.round(job.salary_max! / 1000)}k`
    : null,
  job_type: job.contract_type || "fulltime",
  about_role: job.description, // Adzuna returns snippet — used as description
  match_score: scoredJob.matchScore,
  match_reason: scoredJob.matchReason,
  matched_skills: scoredJob.matchedSkills,
  missing_skills: scoredJob.missingSkills,
  found_at: new Date().toISOString(),
};
```

**Rules:**

- Always include `category=it-jobs` — never search Adzuna without this filter
- Never pass `where` if location is empty — omit the parameter entirely
- `source` is always `'search'` for Adzuna jobs — never any other value
- `salary_is_predicted: "1"` means Adzuna estimated the salary — this is normal
- Adzuna description is a snippet — GPT-4o scores from it, not a full description
- Default country to `'us'` — support `gb`, `au`, `ca` as alternatives

---

## Browserbase

**Check first:** Check AGENTS.md for an installed Browserbase skill. If a Browserbase MCP server is configured — use it. The skill/MCP will have the latest session management and API patterns.

### Session Creation — Company Research

```typescript
import Browserbase from "@browserbasehq/sdk";

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });

// Single session for company research — sequential page visits
const session = await bb.sessions.create({
  projectId: process.env.BROWSERBASE_PROJECT_ID!,
  timeout: 120, // 2 minute session — visits 3-4 pages max
});
```

**Important — Browserbase runs independently from your Next.js server:**
Browserbase sessions run on Browserbase's cloud infrastructure, not inside your Next.js API route. The API route triggers the Browserbase session and returns a response while the session continues running independently on Browserbase's platform. Do not add `maxDuration` or any timeout configuration to Next.js API routes to accommodate Browserbase session length.

**Rules:**

- Always use single sessions — never parallel sessions (free plan limit)
- Session timeout is 120 seconds — sufficient for 3-4 page visits
- Always end sessions cleanly — call stagehand.close() when done
- Project ID always from `process.env.BROWSERBASE_PROJECT_ID` — never hardcode
- Browserbase client lives in `lib/browserbase.ts` — always import from there

---

## Stagehand

**Check first:** Check AGENTS.md for an installed Stagehand skill. If a Stagehand MCP server is configured — use it. The skill/MCP will have the latest act() and extract() patterns.

### Initialisation

```typescript
import { Stagehand } from "@browserbasehq/stagehand";

const stagehand = new Stagehand({
  env: "BROWSERBASE",
  apiKey: process.env.BROWSERBASE_API_KEY!,
  projectId: process.env.BROWSERBASE_PROJECT_ID!,
  browserbaseSessionID: session.id,
  model: { modelName: "openai/gpt-4o", apiKey: process.env.OPENAI_API_KEY! },
  disablePino: true,
});

await stagehand.init();
const page = stagehand.context.activePage()!;
```

### extract()

```typescript
import { z } from "zod";

const result = await stagehand.extract({
  instruction:
    "Extract the company overview, main product description, and any technology mentions from this page.",
  schema: z.object({
    companyOverview: z.string().optional(),
    mainProduct: z.string().optional(),
    techMentions: z.array(z.string()).optional(),
    navLinks: z
      .array(
        z.object({
          label: z.string(),
          url: z.string(),
        }),
      )
      .optional(),
  }),
});
```

### act()

```typescript
// Always wrap in try/catch
try {
  await stagehand.act({
    action: "Click the About link in the navigation",
  });
} catch (error) {
  await logAgentError(jobId, null, error);
}
```

## Company Research Section

Replace the existing Stagehand "Company Research Pattern" section in library-docs.md with this:

---

### Company Research Pattern

Three-step process: homepage extraction → sub-page extraction → GPT-4o synthesis.
Job description and user profile come from DB — never re-fetch what you already have.
Browser's only job is the company website.

```typescript
// Step 1 — Homepage extraction
const homepageData = await stagehand.extract({
  instruction:
    "This is a company's homepage. Capture what the company actually does, who it's for, and any concrete signals (funding, customers, scale, mission, recent launches). Then find the internal links most worth visiting to research them as an employer.",
  schema: z.object({
    oneLiner: z.string().describe("What the company does in one sentence"),
    productSummary: z
      .string()
      .describe("What they build/sell and who it's for"),
    signals: z
      .array(z.string())
      .describe("Funding, notable customers, scale, mission, recent news"),
    pageLinks: z
      .array(
        z.object({
          url: z.string(),
          kind: z.enum([
            "about",
            "careers",
            "blog",
            "engineering",
            "product",
            "team",
            "other",
          ]),
        }),
      )
      .describe("Internal links worth visiting"),
  }),
});

// If oneLiner and productSummary are empty — wrong site or parked domain
// Skip to synthesis with job description and profile only
if (!homepageData.oneLiner && !homepageData.productSummary) {
  await stagehand.close();
  // proceed to synthesis with empty companyResearch
}

// Step 2 — Sub-page extraction (max 3, prefer about/blog/engineering/product over careers)
const subPageData = await stagehand.extract({
  instruction:
    "Extract substance that helps a candidate understand this company before applying: what they do, their values and how they work, the specific technologies and tools they use, notable projects or customers, and how the team operates. Ignore nav, footers, cookie banners, and generic marketing copy.",
  schema: z.object({
    keyPoints: z.array(z.string()),
    technologies: z
      .array(z.string())
      .describe("Specific languages, frameworks, tools, platforms"),
    valuesOrCulture: z
      .array(z.string())
      .describe("Stated values, working style, team norms"),
    notable: z
      .array(z.string())
      .describe("Customers, funding, scale, projects, awards"),
  }),
});

// Step 3 — GPT-4o synthesis (after browser closes)
// Feed three data sources: company research + job from DB + profile from DB
const systemPrompt = `You are a sharp career strategist preparing a candidate to apply for a specific role. You are given (a) research collected from the company's own website, (b) the job posting, and (c) the candidate's profile. Produce a concise, concrete briefing that gives this specific candidate an edge for this specific role.

Rules:
- Ground every company claim in the provided research or job posting. Never invent funding, customers, headcount, or facts. If research was thin, infer carefully from the job posting and say what's inferred.
- Be specific to THIS candidate. Connect their actual skills and past work to this company's stack, product, and values. No generic advice that would apply to anyone.
- Turn the candidate's missing skills into a strategy: how to frame the gap honestly and what adjacent experience to lean on.
- Talking points and questions must reference real things from the research, the kind of detail that signals the candidate did their homework.
- Keep every item tight: one or two sentences. No fluff.

Return ONLY valid JSON matching this shape:
{
  "companyOverview": string,
  "techStack": string[],
  "culture": string[],
  "whyThisRole": string,
  "yourEdge": string[],
  "gapsToAddress": string[],
  "smartQuestions": string[],
  "interviewPrep": string[],
  "sources": string[]
}`;

const userPrompt = `COMPANY RESEARCH (from their website):
${JSON.stringify(companyResearch)}

JOB POSTING:
Title: ${job.title}
Company: ${job.company}
Description: ${job.description}
Matched skills (already computed): ${job.matched_skills.join(", ")}
Missing skills (already computed): ${job.missing_skills.join(", ")}

CANDIDATE PROFILE:
Current title: ${profile.current_title}
Experience: ${profile.years_experience} years, level ${profile.experience_level}
Skills: ${profile.skills.join(", ")}
Work history: ${JSON.stringify(profile.work_experience)}`;

const response = await openai.chat.completions.create({
  model: "gpt-4o",
  response_format: { type: "json_object" },
  temperature: 0.4,
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ],
});
```

**Dossier fields:**

| Field           | Type     | Purpose                                             |
| --------------- | -------- | --------------------------------------------------- |
| companyOverview | string   | What the company does                               |
| techStack       | string[] | Technologies they use                               |
| culture         | string[] | Values and working style                            |
| whyThisRole     | string   | Why this role exists                                |
| yourEdge        | string[] | Specific links between THIS candidate and this role |
| gapsToAddress   | string[] | Missing skills reframed as strategy                 |
| smartQuestions  | string[] | Questions that show real research                   |
| interviewPrep   | string[] | Topics to prepare for this role                     |
| sources         | string[] | Pages the company info came from                    |

**Rules:**

- Always use `extract()` with a Zod schema — never parse raw HTML or use regex
- Always wrap every `act()` and `extract()` in try/catch
- Always call `await stagehand.close()` when done — ends the Browserbase session
- Model is always `gpt-4o` — never use other models
- Temperature is `0.4` for synthesis — grounded but flexible enough to make real connections
- Max 3 sub-pages — never exceed this on free plan
- Always close session in finally block — never leave sessions open even if research fails
- Job description and profile always come from DB — never re-fetch via browser
- If browser research returns empty — still run synthesis with job + profile only
- yourEdge, gapsToAddress, and smartQuestions are the most valuable fields — never skip them

---

## InsForge AI Gateway

**This project does not call OpenAI, Anthropic, or Google directly.** All model access goes through the InsForge AI gateway, already available on the installed `@insforge/sdk` as `client.ai`. There is no `OPENAI_API_KEY` and no `openai` package. Usage is billed to InsForge credits — the free plan includes $1/month, refreshed monthly, which is roughly 1,250 resume extractions.

Verified on this project (2026-08-28): 531 models, 133 of them file-capable, brokered via OpenRouter. Model ids are `provider/model`, e.g. `google/gemini-2.5-flash`, `openai/gpt-4o`, `anthropic/claude-sonnet-5`. List them with `GET /api/ai/models` (admin key required — the anon key is rejected on that endpoint, though it is accepted for chat completions).

### Basic call

```ts
const insforge = await createInsforgeServer();
const completion = await insforge.ai.chat.completions.create({
  model: "google/gemini-2.5-flash",
  messages: [{ role: "user", content: "…" }],
  maxTokens: 64,
});
const text = completion.choices[0].message.content;
```

### Response shape — two different shapes, do not mix them up

| Layer | Shape |
| --- | --- |
| Raw HTTP `POST /api/ai/chat/completion` | `{ text, tool_calls, metadata: { usage } }` |
| SDK `client.ai.chat.completions.create` | OpenAI-normalized: `{ id, object, created, model, choices, usage }` |

Through the SDK, read `choices[0].message.content` and `choices[0].message.tool_calls`. Reading the raw `text` / `tool_calls` fields off the SDK result returns `undefined`.

### The 30-second timeout

The SDK's HTTP client defaults to `timeout: 30000`. A real multi-page PDF exceeds that — the gateway has to fetch the file, parse it, and run the model. Pass a longer `timeout` (or `0` to disable) when constructing a client for AI work; keep the default for session reads. See `app/api/resume/extract/route.ts`.

### PDF and image input

Send the file as a content part alongside the text prompt, and enable the parser:

```ts
messages: [{ role: "user", content: [
  { type: "text", text: prompt },
  { type: "file", file: { filename: "resume.pdf", file_data: signedUrl } },
] }],
fileParser: { enabled: true },
```

`file_data` accepts either a URL or a `data:application/pdf;base64,…` URI. Both work. Prefer a **short-lived signed URL** from `storage.from(bucket).createSignedUrl(key, seconds)` — base64 inflates a 5MB PDF to ~6.7MB of JSON. Never return that signed URL to the browser.

### Structured output — forced tool calls, and when NOT to force them

`ChatCompletionRequest` has **no `response_format`**, so JSON mode is unavailable. Use `tools` plus `toolChoice`. `arguments` arrives as a **JSON string** — parse it inside a `try`/`catch`, then validate with zod. `enum` constraints in the tool's JSON schema are honored.

**Hard-won rule: never force a tool call on input the model may not be able to read.** With `toolChoice: "required"` and an empty or unreadable PDF, the model cannot decline — so it invents plausible content. Measured on a text-free PDF: it returned a complete fabricated profile ("John Doe", San Francisco, generic skills), and did so whether `toolChoice` was `"required"` or `"auto"`, with or without a prompt rule forbidding invention and a `document_contains_resume` flag in the schema. Prompt wording does not fix this.

What does work: **gate on a separate probe call that has no tool attached.** Asked plainly to copy the first words of the document or reply `EMPTY_DOCUMENT`, the model answered correctly 10/10 (5/5 blank, 5/5 real CV, byte-identical replies). With no schema to fill, there is nothing to invent into. Run the probe first, and only extract when it reports readable text.

### Model choice and cost

Two constants in `app/api/resume/extract/route.ts`: `EXTRACTION_MODEL` and `PROBE_MODEL`. Benchmarked against a real CV on 8 ground-truth checks — surname, city, LinkedIn URL, employer, degree, institution, skill count, phone digits:

| Model | in / out per M | Checks | Cost per extraction |
| --- | --- | --- | --- |
| `google/gemini-2.5-flash` | $0.30 / $2.50 | **8/8** | $0.00164 |
| `openai/gpt-4.1-mini` | $0.40 / $1.60 | 7/8 | $0.00145 |
| `openai/gpt-4o-mini` | $0.15 / $0.60 | 5/8 | $0.00046 |
| `google/gemini-2.5-flash-lite` | $0.10 / $0.40 | fails identity | $0.00030 |
| `openai/gpt-5-nano` | $0.05 / $0.40 | never calls the tool | — |

**Do not downgrade the extraction model to save money.** The cheap tiers fail on identity fields: `flash-lite` misspelled the surname and returned the wrong city, and `gpt-4o-mini` silently dropped LinkedIn, degree, and institution. Those are precisely the errors a user saves without noticing.

The saving lives in the probe, which only decides whether the document has text — it runs on `flash-lite` at `maxTokens: 24`, cutting that call from ~$0.00041 to ~$0.00009.

Total is roughly **$0.0017 per extraction**, about 580 on the free plan's $1/month credit. The PDF is paid for twice in prompt tokens, once per call; that duplication is the deliberate price of the no-fabrication guarantee above.

### Other supported options

`webSearch: { enabled, maxResults }` (citations land in `message.annotations`), `thinking: true` on Anthropic models, `stream: true` for an async iterable, plus `temperature`, `topP`, `maxTokens`, and `parallelToolCalls`. `client.ai.embeddings.create` and `client.ai.images` also exist.

### Deprecation note

InsForge's own architecture docs describe the backend AI proxy routes as "deprecated compatibility wrappers" and suggest reading `OPENROUTER_API_KEY` from the dashboard and calling the provider directly server-side. The gateway works today and needs no key, so this project uses it. If it is ever withdrawn, the migration is confined to the model constant and the call site.

---

## OpenAI GPT-4o (SUPERSEDED — use the InsForge AI Gateway section above)

**Check first:** Check AGENTS.md for an installed OpenAI skill. The skill will have the latest API patterns and model capabilities.

### Structured JSON Response

```typescript
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const response = await openai.chat.completions.create({
  model: "gpt-4o",
  response_format: { type: "json_object" },
  temperature: 0.3,
  messages: [
    {
      role: "system",
      content: "You are a job matching assistant. Return only valid JSON.",
    },
    {
      role: "user",
      content: `Your prompt here`,
    },
  ],
});

const result = JSON.parse(response.choices[0].message.content!);
```

**Temperature settings:**

- `0.3` — matching, scoring, extraction, research synthesis — deterministic results
- `0.7` — resume generation — natural variation

**Max tokens:**

- Job matching + scoring: `300`
- Company research synthesis: `800`
- Resume generation: `1000`
- Profile extraction from resume: `800`

**Rules:**

- Model string is always `'gpt-4o'` — never use other model names
- Always use `response_format: { type: 'json_object' }` for structured data
- Always parse `response.choices[0].message.content` as string — even with json_object it returns a string
- Always validate parsed JSON before using — wrap in try/catch
- Match threshold is always `MATCH_THRESHOLD` from `lib/utils.ts` — never hardcode 70
- Company research synthesis must always return a complete dossier — never return empty even if browser research failed

---

## PostHog

**Check first:** Check AGENTS.md for an installed PostHog skill. If a PostHog MCP server is configured — use it. The skill/MCP will have the latest client and server patterns.

### Client Setup (Browser) — Next.js 15.3+

PostHog is initialised in `instrumentation-client.ts` at the project root (the Next.js 15.3+ pattern — runs once on the client before hydration). No provider component and no manual init call are needed.

```typescript
// instrumentation-client.ts
import posthog from "posthog-js";

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (token) {
  posthog.init(token, {
    api_host: "/ingest", // reverse-proxied in next.config.ts
    ui_host: "https://eu.posthog.com",
    defaults: "2026-01-30", // autocapture + automatic pageviews ON
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
  });
}
```

**Reverse proxy:** `next.config.ts` routes `/ingest/*`, `/ingest/static/*`, and `/ingest/array/*` to the PostHog EU hosts so ad blockers do not drop events. Keep all three rewrites.

### Identify / Reset

Identification is client-side only.

```typescript
// components/PostHogIdentify.tsx — rendered in app/(app)/layout.tsx for authed users
posthog.identify(userId, { email });

// components/layout/LogoutButton.tsx — reset before the sign-out server action runs
posthog.reset();
```

### Server Setup

```typescript
// lib/posthog-server.ts — used later by server-side product events (job_found, company_researched)
import { PostHog } from "posthog-node";

export function getPostHogClient(): PostHog | null {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) return null;
  return new PostHog(token, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
    flushAt: 1, // send immediately
    flushInterval: 0, // no batching — Next.js functions are short-lived
  });
}
```

**Rules:**

- Client init lives in `instrumentation-client.ts` — never re-init PostHog elsewhere
- Keep autocapture + automatic pageviews ON (`defaults`) — do not set `capture_pageview: false`
- Identify only on the client (`PostHogIdentify`); reset on logout (`LogoutButton`) — never identify server-side
- Server client: always `await posthog.flush()` after capture in a shared client — events are lost without it
- `flushAt: 1` and `flushInterval: 0` always set on server client
- Event names must match exactly the list in `code-standards.md` — no bespoke auth events
- Always include `userId` as a property on every server-side event

---

## @react-pdf/renderer

**Check first:** Check AGENTS.md for an installed react-pdf skill. PDF generation APIs can differ from general training knowledge.

Installed: `@react-pdf/renderer@4.9.0`. Peer range covers React 19. **No `serverExternalPackages` entry is needed** — the package is already in Next.js's default externals list (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverExternalPackages.md`).

### Resume PDF Generation

Working reference: `app/api/resume/generate/`.

```tsx
// resume-document.tsx — JSX lives here, not in route.ts.
// Next.js documents route handlers as route.ts / route.js only, so keep the
// JSX in a colocated .tsx and export a render function the route calls.
import path from 'node:path'
import { Document, Font, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'

const FONT_DIR = path.join(process.cwd(), 'app/api/resume/generate/fonts')

Font.register({
  family: 'Inter',
  fonts: [
    { src: path.join(FONT_DIR, 'Inter-Regular.ttf'), fontWeight: 400 },
    { src: path.join(FONT_DIR, 'Inter-SemiBold.ttf'), fontWeight: 600 },
  ],
})
Font.registerHyphenationCallback((word) => [word]) // default breaks words mid-glyph

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Inter', fontSize: 10 },
  heading: { fontFamily: 'Inter', fontWeight: 600, fontSize: 14 },
})

export function renderResumePdf(profile: Profile): Promise<Buffer> {
  return renderToBuffer(<ResumeDocument profile={profile} />)
}
```

```typescript
// route.ts
const buffer = await renderResumePdf(profile)

// upload() takes File | Blob — NOT a Node Buffer, which is what
// renderToBuffer returns. The Uint8Array copy is required, not ceremony: a
// Buffer may be backed by a SharedArrayBuffer, so it is not assignable to
// BlobPart under strict TypeScript.
const file = new File([new Uint8Array(buffer)], 'generated-resume.pdf', {
  type: 'application/pdf',
})

// Uploading to an existing key REPLACES it (standard PUT semantics per the
// SDK's own doc comment) — there is no upsert flag to pass.
const { data } = await insforge.storage
  .from('resumes')
  .upload(`${userId}/generated-resume.pdf`, file)

// The resumes bucket is PRIVATE. data.url is a record, not a fetchable link —
// hand the browser a short-lived signed URL instead.
const { data: signed } = await insforge.storage
  .from('resumes')
  .createSignedUrl(data.key, 300)
```

### Fonts — do not use the built-in Helvetica

The built-in standard fonts are WinAnsi-only and fail **silently**. Measured on a real render, then confirmed by decoding the PDF's own text operators:

| Input | Helvetica rendered |
| --- | --- |
| `Павел Распопов` | `025;` / ` 0A?>?>2` — mangled into garbage, not blank |
| `•` | dropped entirely — every bullet marker invisible |
| `—` | dropped — `Jan 2021 — Present` becomes `Jan 2021  Present` |
| `·` | fine |
| `José Ferreira-Lühr` | fine — Latin-1 is covered |

The bullet and dash losses affect every document, not just non-Latin ones. Register a Unicode TTF instead. Inter Regular + SemiBold (SIL OFL, the app's own typeface via `next/font`) are bundled at `app/api/resume/generate/fonts/`; after registering, all of the above render correctly **and** pdf.js text extraction returns them character-perfect — which matters because applicant tracking systems parse resumes as text.

`Font.register` takes `src` as a **string** only — a standard font name, a file path, a URL, or a base64 data URL. It does not take a Buffer. Loading by path is preferred over inlining base64 (635KB of TTF becomes ~850KB of base64 in source).

**Fonts loaded by path need a file-tracing entry.** Nothing imports the TTFs, so Next cannot infer them and the serverless bundle ships without them — working in dev and 404-ing only in production:

```typescript
// next.config.ts
outputFileTracingIncludes: {
  '/api/resume/generate': ['./app/api/resume/generate/fonts/**'],
}
```

### Supported CSS properties

The earlier claim in this doc — that only 14 properties work and "others are silently ignored" — is **wrong**, verified against `node_modules/@react-pdf/stylesheet/lib/index.d.ts`. `borderBottomWidth`, `borderBottomColor`, `marginBottom`, `letterSpacing`, `textTransform`, and `flexWrap` are all typed and all render. Check the stylesheet package's types rather than trusting a fixed list; TypeScript rejects an unsupported property at build time.

Colors must be literal values (`'#101828'`) — a PDF has no CSS variables. Copy the values from `app/globals.css` `@theme` so the document matches the app. This is the one place in the codebase where a hex literal is correct.

**Rules:**

- Server-side only — never import in a client component
- Always `renderToBuffer` — not `renderToStream` or `PDFDownloadLink`
- PDF generation only in `app/api/resume/` routes
- Buffer uploaded straight to InsForge Storage — never written to disk
- Save the storage url and key to the profile row after upload
- Every AI route that renders a PDF still needs `export const maxDuration`

---

## pdf-parse (SUPERSEDED — send the PDF to the gateway instead; see InsForge AI Gateway above)

**Check first:** Check AGENTS.md for an installed pdf-parse skill.

### Extract Text from Uploaded Resume

```typescript
import pdf from "pdf-parse";

// In API route handling resume upload
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("resume") as File;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const pdfData = await pdf(buffer);
  const extractedText = pdfData.text; // raw text content

  // Send to GPT-4o for structured extraction
}
```

**Rules:**

- Server-side only — never import in client components
- `pdfData.text` is raw unformatted text — GPT-4o handles the structure extraction
- Always handle parse errors — some PDFs are image-based and return empty text
- If `pdfData.text` is empty or very short — return error to user: "Could not extract text from this PDF. Please try a different file."
