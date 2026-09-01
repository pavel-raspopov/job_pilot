# Memory — Phase 2 Adversarial Review + Fixes

Last updated: 9/1/2026

## What was built

An adversarial `/feature-review` over Phase 2 (Features 05–08), then fixes for
11 findings. Feature 08 itself shipped in the previous session and is committed
as `c9b8f26`.

- **`.agents/skills/feature-review/SKILL.md`** — adversarial review is now the
  skill's **default**, not an opt-in. Added: invert the burden of proof (PASS is
  earned by attacking, never a fallback), distrust the author's own verification
  most of all, name the exact triggering input, two new report sections
  (*Attacked and held*, *Open questions*), and an evidence bar per severity.
  Synced to `.claude/` and `.cursor/` via `npm run sync:agents`.
- **`lib/ai-rate-limit.ts`** (new) — `AI_ROUTE`, `LIMITS` (10/hour per route),
  `checkAiRateLimit`, `recordAiCall`, `retryAfterPhrase`. Both AI routes wired.
- **`db/migrations/004_add_ai_usage.sql`** (new, **applied**) — `ai_usage` table.
- **`lib/ai-rate-limit.ts` + `types/index.ts`** — new `ExtractedEducation` type.
- **Modified:** `resume-document.tsx` (shared `renderableRoles`, density-scaled
  stylesheet factory, measured page-fit loop), `generate/route.ts`,
  `extract/route.ts`, `ProfileForm.tsx` (`draftFromForm`, `mergeEducation`, save
  ref guard), `ResumeUpload.tsx` (extract + upload ref guards), `actions/profile.ts`
  (PDF magic bytes, email fallback), `architecture.md`, `code-standards.md`,
  `library-docs.md`, `progress-tracker.md`, `openspec/specs/profile/spec.md`.

Full finding-by-finding record is in `context/progress-tracker.md` under
"Phase 2 adversarial review".

## Decisions made

- **One function decides which roles count.** `renderableRoles(profile)` is
  exported from `resume-document.tsx` and used by *both* the document and the
  route's `buildModelInput`. The Critical bug was two derivations of that list
  disagreeing. **Rule for Features 10/13: when model output is keyed by position
  into a list, exactly one function may compute that list.**
- **"One page" is enforced by measurement, not by a constant.** `renderResumePdf`
  renders, reads `/Count` from the PDF page tree, and steps down
  `PAGE_FIT_LADDER`. The ladder **tightens type before dropping a bullet** — a
  denser resume still says everything the candidate did. Rung 0 is the old
  behaviour, so anything that already fitted renders byte-identically. No
  constant can promise a fit; it depends on the profile.
- **Unstated ≠ empty.** `ExtractedEducation` omits sub-fields the resume does not
  state rather than sending `null`/`""`. The form merges per sub-field. Reuse
  this shape wherever a model reports a partial object.
- **Rate-limit state is a log in Postgres, not a counter and not memory.**
  Serverless instances share no memory. Append-only avoids read-modify-write and
  doubles as cost telemetry. RLS is select-own + insert-own with **no update or
  delete policy**. `route` has **no CHECK constraint** — otherwise every new AI
  route becomes a migration. Check *after* the free failure cases; record
  *before* the model call; **fail open** if the limiter's own query errors.
- **Every billed action needs a `useRef`, not a `disabled` attribute.**
- `openspec/specs/profile/spec.md` was edited **directly** (new *AI request rate
  limiting* requirement) because there was no active change to attach a delta
  to. Validates strict. Reconstruct as a retroactive change if the paper trail
  matters.

## Problems solved

- **An AI reviewer's default failure mode is agreeableness.** Reading code,
  reconstructing the author's intent, and reporting PASS only proves the code is
  self-consistent. Both proven defects survived lint, build, TypeScript, a prior
  3-layer review, and the author's own live verification.
- **Compile the module out of Next.js and render it.** `npx tsc` with a throwaway
  tsconfig (`jsx: react-jsx`, `paths`, `outDir` inside the project so Node
  resolves `node_modules`) emits usable JS despite type errors. That harness
  turned two arguments into reproductions and later proved the fixes. Rebuild it
  for any PDF change — it is the only cheap way to test the renderer.
- **Differential rendering beats text extraction for proving PDF bugs.** Render
  twice with different inputs and diff the bytes; if two renders differ only in
  the `/ID` trailer, the input made no difference. That is how "the real
  employer's bullets were silently discarded" was established without decoding
  subset-font glyphs.
- **A fixture that happens to fit proves nothing.** The 43-skill / **2**-role
  profile is exactly the case that stays on one page; the third role the form
  allows tips it to two.
- **`NaN` in a `@react-pdf` style does not throw** — `@react-pdf/stylesheet` logs
  a parse error and renders without that property. TypeScript is the only guard,
  so keep such fields required (this bit the test harness, not the app).
- **Line endings are mixed in this repo.** `resume-document.tsx` and
  `generate/route.ts` are LF; everything else is CRLF. Any scripted edit must
  normalise to LF, patch, then restore — `grep -q $'\r'` is not a reliable
  detector.
- **The InsForge MCP connects at session start.** When it is down, drive it over
  stdio with the command and env from `.mcp.json` + `.claude/settings.local.json`
  (newline-delimited JSON-RPC: `initialize` → `notifications/initialized` →
  `tools/call`). Each call re-spawns `npx`, so batch SQL into one call and expect
  20–40s per invocation — a two-statement script can exceed a 180s timeout.

## Current state

- `npm run lint`, `build`, `check:agents`, `check:sync`, and
  `openspec validate --specs --strict` all pass.
- **Committed to `main`.** Nothing deployed.
- **Verified live** against the real profile (~$0.005 spent): double-clicked
  Extract → 1 POST; markers typed into two fields the CV omits survived
  extraction while stated fields correctly overwrote; reload discarded everything
  unsaved; double-clicked Generate → 1 POST; the generated PDF is genuinely
  1 page; 10 synthetic `ai_usage` rows → Generate refused in <4s with no gateway
  call, and the pre-cleanup count was still exactly 10 (a refused request does
  not count); after clearing, one real generation recorded exactly one row.
  Console and server logs clean.
- **`ai_usage` holds one real row** from that last generation. Table confirmed by
  `get-table-schema`: RLS on, select/insert-own only.
- A dev server may still be running on port 3000 (`preview_start`,
  `jobpilot-dev`).

## Next session starts with

`/opsx-propose` **Feature 09 Find Jobs Page — Full UI**, the first item in
Phase 3. Mock-data UI feature, so `/impeccable shape` is worth running if any
visual decision is open; the binding design is `context/designs/`.

Before Feature 10 or 13 writes an AI route, read the new **"Routes that call the
AI gateway"** subsection in `context/code-standards.md` — `maxDuration`, the
rate-limit check, and a UI ref guard are all mandatory, and each is there
because it already cost real money or a real bug.

## Open questions

- **`ai_usage` retention is unhandled.** Rows outlive their window and nothing
  prunes them (~240/user/day worst case). Cleanup statement is in migration
  `004`'s header comment, waiting for a scheduled job.
- **The `education` per-sub-field merge is not covered end to end.** It only
  fires where the resume is silent, and the test CV states all four fields.
  Type-checked and small, but unexercised.
- `architecture.md` and `library-docs.md` Stagehand snippets are now
  **placeholders under an UNRESOLVED note**: Stagehand builds its own LLM client
  and cannot call `insforge.ai.chat.completions.create`, so **Feature 13 must
  settle how it reaches a model** — likely an OpenAI-compatible base URL pointed
  at the gateway. Do not reintroduce `OPENAI_API_KEY`.
- **Extraction still gets work-history dates wrong often enough to matter** —
  second recorded instance. Review-before-save is load-bearing, not a nicety.
- `maxDuration = 120` vs the hosting plan's ceiling — unverified, nothing
  deployed.
- Feature 06 leftovers still open: save-success copy, resume file input not
  resetting after upload, skills/industries tag input not clearing after "Add".
- Cline and Cursor are not installed here; those config trees are unverified.
- Refused AI requests return HTTP 200 with `{ success: false }`, matching the
  route convention rather than 429. Deliberate, but worth revisiting if these
  routes ever get a non-browser caller.

## Testing notes

- `assets/CV Pavel Raspopau ….pdf` (121,878 bytes) is the extraction fixture and
  matches what is in storage. **Not committed** — it holds real contact details.
- **Never click Save Profile while testing extraction** — it would persist
  whatever is in the form over the real profile. Reload instead; that discards
  unsaved edits and re-proves review-before-save.
- Driving the PDF from the browser: `fetch` the signed URL, then count
  `/Type /Pages … /Count` in the bytes. Full text extraction needs `pdfjs-dist`
  from a CDN; `pdftoppm` is not installed and the Browser pane will not render a
  PDF navigation.
- The uncontrolled profile inputs take a plain `element.value = …` (no React
  state involved). The *controlled* role inputs still need the native value
  setter plus `input`/`change` events.
- Do **not** clear `document.body` while React is mounted — it throws
  `removeChild` errors that look like product bugs.
