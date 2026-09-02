## Context

See `proposal.md` — Why. Requirements are in `specs/job-discovery/spec.md` and
`specs/find-jobs/spec.md`; this document covers only how they are met.

Three pieces of existing structure constrain the approach:

- **`architecture.md` fixes `components/find-jobs/` at four files** and assigns agent
  logic to a top-level `agent/` directory that does not yet exist. Invariants: agent code
  never imports from `/components` or `/actions`; agent functions are called only from API
  routes; API routes contain no UI logic.
- **`code-standards.md` "Routes that call the AI gateway"** makes three things mandatory,
  each written after a real bug: `maxDuration` ≥ the AI client's 120s timeout, a
  server-side rate-limit check, and a synchronous `useRef` in-flight guard in the UI.
- **Both shipped AI routes** (`app/api/resume/extract`, `app/api/resume/generate`)
  establish the shape this route copies: a local `fail()` returning HTTP 200 with
  `{success:false,error}`, user-facing strings hoisted to module constants, tool-calling
  with a fully-optional zod schema, and two clients per route — `createInsforgeServer()`
  for auth/DB/rate-limit and `createAiClient()` for the model call.

No migration. `agent_runs` and `jobs` exist in `001_initial_schema.sql`, and
`ai_usage.route` is free text so a new rate-limit key needs no schema change.

### Files in scope

**New:** `agent/adzuna.ts`, `agent/matcher.ts`, `app/api/agent/find/route.ts`,
`lib/parse-job.ts`.

**Modified:** `lib/env.ts`, `lib/ai-rate-limit.ts`, `types/index.ts`,
`app/(app)/find-jobs/page.tsx`, `components/find-jobs/SearchControls.tsx`,
`components/find-jobs/JobsTable.tsx`, plus the four `context/` docs named in the proposal.

**Frozen:** `components/find-jobs/JobFilters.tsx`, `components/find-jobs/JobsPagination.tsx`,
`lib/utils.ts`, `lib/insforge-ai.ts`, `lib/insforge-server.ts`, `lib/parse-profile.ts`,
`proxy.ts`, `db/migrations/*`, everything under `app/api/resume/`. One-line type or compile
fixes only, and only if `npm run build` fails.

## Goals / Non-Goals

**Goals**

- A search is a single billed unit: one gateway call, one rate-limit slot, one run record.
- No partial-credit failure states. Every outcome leaves `agent_runs` terminal and the
  user told something specific enough to decide whether to retry.
- Discovery data survives scoring failure — the listings are real and the user paid the
  wait for them.
- Replace only the source of the job array. Filter, sort, and pagination code is untouched
  so Feature 11 has a clean seam.

**Non-Goals** (design-level; product scope is in the proposal)

- No streaming or progressive rendering of results. One request, one response.
- No retry, backoff, or queueing on either the provider or the gateway call.
- No caching of provider responses across searches or users.
- No deduplication of a job already saved from an earlier search. Feature 11 owns list
  semantics; deduping now would need a uniqueness rule the schema does not carry.

## Decisions

### D1. Adzuna credentials get a separate, lazily-validated accessor in `lib/env.ts`

**Not** an extension of the existing `envSchema`. Verified by tracing imports:
`lib/insforge-client.ts` (the browser client) and `proxy.ts` both `import { env }`, and
`loadEnv()` runs at module load. Next.js inlines only `NEXT_PUBLIC_*` into the client
bundle, so a server-only key added to that schema evaluates to `undefined` in the browser
and `loadEnv()` throws during module evaluation, taking down the page.

`lib/insforge-client.ts` currently has **zero importers**, so this would ship green and
detonate the first time a client component imports it — a latent trap, not a visible bug.

Add instead a second `serverEnvSchema` with a cached `serverEnv()` accessor validated on
first read. Callers reach it inside their own try/catch, so a misconfigured deploy surfaces
as "job search is unavailable" plus a loud server log, not a 500.

*Alternatives:* extending `envSchema` (rejected above); reading `process.env.X!` directly as
`library-docs.md` shows (rejected — violates `code-standards.md`, and loses the readable
boot-time failure the file exists to provide); a separate `lib/server-env.ts` (rejected —
same file keeps the two schemas visibly adjacent, and `architecture.md`'s tree stays
unchanged).

### D2. One batched scoring call, with an explicit index per job

All ten listings and the profile go in one gateway call; the tool schema requires a
`job_index` on every returned entry.

**The index is load-bearing, not defensive.** With ten array positions and no index, a
model that returns seven entries shifts every later score onto the wrong employer — and
the failure is invisible, because all ten rows still render plausibly. With the index, a
short reply simply leaves some jobs unscored. This is the identical call Feature 08 made
with `role_index`, for the identical reason.

*Alternatives:* ten parallel calls (rejected — ~10× cost per search for richer per-job
reasoning the UI does not yet show; revisit if Feature 12's detail page needs depth);
batch-then-retry-the-missing (rejected — best resilience, but the cost is a second billed
call on a path that already degrades acceptably).

### D3. Match scores are clamped and rounded before they reach the database

`jobs.match_score` carries `CHECK (match_score BETWEEN 0 AND 100)` and the ten rows are
written as **one** `insert([...])` — a single PostgREST statement. One model-produced `105`
would therefore reject **all ten rows**, converting a good search into a service error.

The clamp is a correctness requirement, not hygiene. `Math.round` likewise: the column is
`integer`.

This is also why a per-row insert loop is not the fallback — ten round trips, and a
genuinely partial state whose `jobs_found` count nothing could trust.

### D4. The rate-limit check runs before the provider; the record runs after it

Split deliberately:

- **Check before Adzuna** so the 10/hour ceiling bounds the shared provider free-tier quota
  as well as model spend.
- **Record after a successful Adzuna response, immediately before the model call**, per the
  standard ("record immediately before the model call — attempts are what the limit
  counts").

**This was implemented wrongly and corrected after review.** The first cut recorded the
slot after the zero-result branch, so a zero-result search consumed nothing and the quota
protection above was defeated. The record now runs as soon as the provider answers.

The consequence worth stating: a search that returns zero listings still consumes a slot,
so a loop of zero-result queries cannot drain the provider quota for free — but a provider
*outage* never charges the user, because the failure path returns before the record.

### D5. Failure taxonomy — what degrades, what fails

| Condition | User sees | Run | Jobs |
|---|---|---|---|
| Bad input / unauthenticated / no profile / thin profile / rate limited | Specific message naming the fix | none created | 0 |
| Provider error, timeout, malformed body, missing credentials | "Job search is unavailable" | `failed` | 0 |
| Zero provider results | Informational "no jobs found" | `completed`, 0 | 0 |
| **Scoring fails entirely or partially** | **Success with counts** | `completed` | **saved, scores null** |
| `jobs` insert fails | "Could not complete your search" | `failed` | 0 (atomic) |
| Analytics fails | Success with counts | `completed` | saved |

Two constants, not one, for the failure copy: a provider outage and an internal fault imply
different retry decisions, and the distinction costs one string.

**Scoring failure degrading to saved-but-unscored** mirrors Feature 08's "a failed rewrite
degrades to plain-but-correct". It is the one outcome a user may read as *odd* rather than
*broken*, and it is still the right trade: the listings are real, and a repeat search bills
them again.

### D6. Agent modules never throw

`searchJobs()` returns a discriminated union; `scoreJobs()` returns an array index-aligned
with its input where `null` means unscored. Neither rejects.

This keeps the route's control flow linear and makes every failure a value the route maps
to copy, rather than a `catch` block that has lost the context needed to say which stage
failed. The route keeps an outer try/catch only for genuinely unexpected throws.

`agent/adzuna.ts` also normalises the provider's response shape, so no Adzuna field naming
reaches the route.

### D7. Country inference is conservative by design

Match country names and unambiguous country abbreviations only. Never cities, never
regional abbreviations: "San Francisco, CA" is California, "Indianapolis, IN" is Indiana,
"London, ON" is Ontario. Scan comma-separated segments right to left, since "Austin, Texas,
USA" names its country last. Default to `us`.

A city list looks helpful and is a source of silently-wrong countries, whose only symptom is
an empty result set with no explanation. Four countries (`us`/`gb`/`ca`/`au`) matches
`library-docs.md`; extending it is a one-line map change.

"Remote" and similar are treated as working arrangements, not places, and omitted from the
location parameter — the field's own placeholder text invites the word, and passing it
through matches almost nothing.

### D8. The client owns no counts; the run does

`SearchControls` loses its `jobsFound` / `strongMatches` props and takes them from the
response instead.

Feature 09 passed them as props specifically so the banner could not contradict the rows.
That reasoning inverts once the table holds history: a user with 24 saved jobs whose search
finds 3 must be told **3**, and `jobs.length` would say 27. The banner's job changes from
describing the table to describing the run. `ui-registry.md` records the old rationale and
must be rewritten, not silently contradicted.

The route computes `strongMatches` with the same `HIGH_MATCH_THRESHOLD` the table bands
scores with — one constant, no second literal free to drift.

### D9. Refresh with `router.refresh()`, plus `revalidatePath` on the server

`router.refresh()` re-runs the server tree and reconciles into the *existing* React tree, so
the success banner stays up and the table's query/filter/sort/page survive. That preservation
is the whole reason for the choice.

`revalidatePath("/find-jobs")` in the route additionally covers later navigations from
elsewhere; it re-renders nothing currently mounted, so it is not a substitute.

*Alternatives:* `location.reload()` (rejected — destroys the banner the user is reading and
their filter state); lifting rows into client state from the response (rejected — the
response carries counts, not rows, and it would move list ownership out of the page).

### D10. `lib/parse-job.ts` rather than an assertion

`insforge.database.from()` types `data` as `any[]`, so assigning it to `Job[]` compiles with
zero checking — the `any` leak `code-standards.md` forbids — and `as Job[]` is the assertion
it also forbids. `lib/parse-profile.ts` exists for exactly this and is the pattern to mirror.

It goes in `lib/` rather than inline in the page (where the mock array deliberately lived)
because Feature 12 parses single rows from the same table.

### D11. `found_at` is left to the database default

Omitted from the insert. The column defaults to `now()`, and the UI renders it as "2 hours
ago" — letting the caller stamp it invites a client/server clock disagreement in the one
column whose display is relative. This diverges from `library-docs.md`'s snippet.

### D12. Model choice is deferred to a measurement, not assumed

`code-standards.md`: "Model choice is a measurement, not a preference." The starting
candidate is `google/gemini-2.5-flash` — the only model both shipped features chose, and the
only one measured to honour a positional-index instruction, which D2 depends on.
`gemini-2.5-flash-lite` is the cheaper candidate to measure against it.

**Measured outcome — the assumption was wrong.** `gemini-2.5-flash-lite` won and is what
ships. On the same payload both models scored 10/10 with correct indices and invented zero
skills; flash-lite discriminated slightly better (7 distinct scores to flash's 6, where flash
produced a four-way tie and filled the skill cap on every row) and costs ~3.6x less
(~$0.0007 vs ~$0.0025 per search). Confirmed on a second payload in a different market. The
numbers and the caveat about sample size live in the comment above `MATCHING_MODEL`.

Output is capped with `maxTokens`; output is the dominant cost. Truncation breaks the tool
JSON, which degrades to an unscored batch (D5) rather than to a half-written score set.

### D13. Two things deliberately not built

- **No `agent_logs` writer.** `code-standards.md` asserts a `logAgentError()` that does not
  exist, and Feature 10's scope never asks for it. Building the helper for one caller is
  scope creep; Feature 13 genuinely needs it. Recorded as a decision in
  `progress-tracker.md`, not left as an omission.
- **No `agent/types.ts`.** `architecture.md` names it, but each type here has exactly one
  owner and two consumers. A types file for four types across two modules is a barrel by
  another name. Build it when a third module needs a type it does not own — the same call
  already made and documented for `ResumePreview.tsx`.

### D14. The profile gate is lighter than Feature 08's

Gate on "has skills **or** a current title", not the full 12-field `isComplete` check
Feature 08 uses. Match quality depends on skills, title, and experience — not on a phone
number or work-authorization field. Blocking a search over a missing phone number spends
the user's intent on an errand unrelated to what they asked for, and the dashboard's
completion banner already nags for the rest.

Approved by the developer during planning. Swapping in `getProfileCompletion().isComplete`
is a one-line change if consistency with Feature 08 is later preferred.

### D15. The server owns `job_search_started` (corrected during verification)

Both halves originally fired it. Verification found **7 events for 4 searches**: every
search that ran was counted twice, and a rate-limited search that never started was
counted once. That contradicts two scenarios in `specs/job-discovery/spec.md` — "a
started search is counted once" and "a refused search is not counted as started".

The route owns it, fired after the rate-limit check and the run insert. The client
cannot own it: it does not know whether the search will be refused, so anything it
emits inflates the top of the funnel. `job_found` was already server-side, so both
events now sit together.

Consequence: `SearchControls` no longer needs `userId`, and the prop is gone.

## Risks / Trade-offs

- **A `.env.local` edit is a human gate.** Without `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` the
  feature is verifiable only up to its free-failure paths → the credentials are added and
  confirmed with a single hand-run request *before* any code is written, so a later 403 is
  unambiguously a code bug.
- **Adding a server-only var to `lib/env.ts` is exactly the mistake D1 avoids.** A later
  contributor may "tidy" the two schemas into one → the reason is written as a comment in
  the file, not only here, and `npm run build` is run immediately after that step.
- **One batched call is all-or-nothing per search.** A malformed response costs all ten
  scores → jobs still save (D5), the index scheme (D2) salvages partial responses, and the
  clamp (D3) removes the most likely cause of a total insert failure.
- **10 searches/hour × 10 listings is 100 rows/hour/user with no dedup.** A user repeating
  one query accumulates duplicates → accepted for this feature; the page is unpaginated
  server-side until Feature 11, which owns list semantics and is where dedup belongs.
  **Measured obstacle for that feature:** Adzuna's `redirect_url` is a per-request tracking
  link, so three searches for the same query produced 8 listings at 3 copies each with
  three *different* `external_apply_url` values. Grouping by URL finds no duplicates at
  all. Dedup needs a composite key (title + company, at least), not the apply URL.
- **The success banner appears a beat before the refreshed rows.** → Accepted. A
  `useTransition` treatment would couple two sibling components, and the user has just
  waited tens of seconds with explicit feedback.
- **PostHog events can be dropped on serverless freeze.** `lib/posthog-server.ts` uses
  `flushAt: 1` but nothing awaits the request → `await flush()` after the captures, wrapped
  in try/catch so analytics can never fail a search whose jobs are already saved. Not
  `shutdown()` — the client is a reused module singleton.
- **A stale `running` run row** if the terminal update fails after a good insert → the run
  id is held outside the try so the outer catch can still mark it failed; a failed terminal
  update is logged and swallowed, because the jobs are saved and a bookkeeping row must not
  turn a successful search into an error.

## Migration Plan

No database migration and no new dependency.

1. Add `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` to `.env.local` (no `NEXT_PUBLIC_` prefix) and
   confirm with one manual provider request.
2. Ship server-side first (env accessor → rate-limit key → types → agent modules → route).
   The route is inert until the client calls it, so each step is independently buildable.
3. Ship the client half (page → `SearchControls` → `JobsTable`), which is the first point
   at which a user can spend money.
4. Deployment additionally requires both variables in the hosting environment. Absent them,
   the feature degrades to "job search is unavailable" and every other page is unaffected
   (D1) — a soft failure, not an outage.

**Rollback:** revert the change. The `jobs` and `agent_runs` rows written meanwhile are
valid data with no schema dependency on this feature; the reverted page shows the mock
array again and orphans nothing.

## Open Questions

None blocking. Two items are tracked as tasks rather than questions: the model benchmark
numbers (D12) must replace their placeholder before merge, and `context/ui-registry.md`'s
SearchControls entry must be rewritten to record the reversal in D8 rather than left
contradicting it.
