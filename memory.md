# Memory — Feature 09 Find Jobs Page (Full UI)

Last updated: 9/2/2026

## What was built

Feature 09, the first item of Phase 3. `/find-jobs` had been linked from the
Navbar and listed in `proxy.ts`'s protected routes since Feature 01, but the
route did not exist — the link 404'd. It now serves the full page against a
24-job mock array. No Adzuna, no DB, no AI, no PostHog event, no new dependency,
no migration.

OpenSpec change `add-find-jobs-ui` — proposed, applied, reviewed, and archived to
`openspec/changes/archive/2026-09-02-add-find-jobs-ui/`. Its delta spec was
merged into a new `openspec/specs/find-jobs/spec.md` (7 requirements, 23
scenarios).

- **New:** `app/(app)/find-jobs/page.tsx` (server component; holds the mock array
  and derives the banner's counts), `components/find-jobs/SearchControls.tsx`,
  `JobFilters.tsx`, `JobsTable.tsx`, `JobsPagination.tsx`, and `lib/utils.ts`
  (`formatRelativeDate`, `HIGH_MATCH_THRESHOLD`).
- **Modified:** `types/index.ts` (`Job`, `JobSource`, `MatchFilter`, `JobSort`),
  `context/ui-registry.md`, `context/architecture.md`,
  `context/progress-tracker.md`.

The full decision record is in `context/progress-tracker.md` under "Feature 09
Find Jobs Page — Full UI".

## Decisions made

- **`JobsTable` is the stateful container, not a bare table.** It owns `query`,
  `matchFilter`, `sort`, `page` and composes `JobFilters` and `JobsPagination`,
  which are presentational. All three read one derived list, so one owner is
  forced, and `architecture.md` fixes that directory at four files — a fifth
  `JobsList.tsx` wrapper would contradict it. Recorded in both docs because the
  name undersells the role.
- **`HIGH_MATCH_THRESHOLD` (70) is one exported constant** in `lib/utils.ts`,
  read by both the High Match filter and the green score band. They are the same
  boundary; two literals would be free to drift. This is Feature 08's Critical
  bug (two derivations of one list disagreeing) applied preventively. It went in
  `lib/utils.ts`, not `types/index.ts`, because that file is types-only and fully
  erasable.
- **Six columns, not the design's five — a deliberate inversion of the usual
  precedence.** The project default is that the design asset wins (Feature 05).
  The developer overrode it: `jobs.source` is a real migrated column with
  documented badge tokens, and the design predates the distinction.
- **Rows are hover-only, not links.** `/find-jobs/[id]` is Feature 12; linking
  now would ship a known 404, which the project already carried once.
- **Filter/sort/search/pagination are live client-side** over the mock array, as
  plain functions over an array, so Feature 11 replaces where the array comes
  from rather than rewriting components.
- **Where the design is internally inconsistent, derive rather than copy.** Its
  footer says "1 to 6 of 24" beside 8 page buttons (24/6 = 4), so the page count
  is computed and renders 4 — and there is no ellipsis, because truncation could
  not be exercised at this scale and unverifiable code is worse than none. Its
  banner copy ("8 jobs / 4 strong matches") was written against an 8-row mock, so
  the counts are derived and passed as props; the summary cannot contradict the
  rows on screen.
- **Score bands follow `ui-tokens.md`, not the design.** The PNG paints some bars
  blue; green-from-70 was already settled on 2026-07-31. No blue appears.
- Mock data lives in `page.tsx` — the first file Feature 10 opens — rather than a
  `lib/` module that would outlive its purpose by looking like infrastructure.

## Problems solved

- **A click that does nothing may be the harness, not the code.** With an
  emulated viewport (1440x900) inside a small Browser pane, a click reported at
  x=1307 was *delivered* at x=5392. Two controls looked completely dead. Proven
  with a capture-phase `click` listener recording `event.clientX/Y`, then fixed
  by clearing viewport emulation (`resize_window` preset `desktop`). **Reset
  emulation before concluding a control is broken**, and prefer
  `elementFromPoint` + a listener over guessing.
- **`zoom` region-cropping is not supported in the Browser pane**, and an
  emulated wide viewport renders unreadably small there. Verify UI facts with
  `getComputedStyle` and the DOM instead of screenshots — stronger evidence
  anyway. That is how all three colour bands were proven exact
  (`#10B981` / `#FF8904` / `#99A1AF`) rather than eyeballed.
- **A large TSX file breaks a bash heredoc.** `cat > file <<'EOF'` failed with a
  parse error on `JobsTable.tsx`; the Write tool handled it. Also: this repo is
  `core.autocrlf=true` and every file is CRLF, so anything written LF-first needs
  `sed -i 's/\r$//; s/$/\r/'`.
- **The in-app Browser pane holds no auth session**, so `/find-jobs` redirects to
  login there and manual verification of any protected route needs the developer
  to sign in first. Claude in Chrome (which would carry the real session) was not
  connected this session.
- **`<th scope="row">` centres its text** from the UA stylesheet. It was
  invisible only because a `display:flex` child filled the content box. Caught by
  reading computed `text-align`, not by looking.
- **The InsForge MCP had never really worked — root cause found 2026-09-02.**
  `${VAR}` in `.mcp.json` expands from **Claude Code's own process environment**,
  not from `.claude/settings.local.json`. That `env` block feeds tool execution
  (Bash sees the variables) but not the MCP config interpolator, so the server
  received the literal string `${INSFORGE_API_BASE_URL}`, died on `new URL(...)`
  with `ERR_INVALID_URL`, and Claude Code reported only `CONNECTION_CLOSED`.
  **11 of 12 launches failed identically** from 2026-08-27 to 2026-09-02; the one
  success (2026-08-27 18:04, which ran the Feature 04 migrations) was launched
  from a shell that already had the variables exported. The credentials were
  never the problem. Fixed by persisting `INSFORGE_API_KEY` and
  `INSFORGE_API_BASE_URL` as Windows **user-scope** env vars;
  `settings.local.json` keeps its copy for tool-side use. Verified by spawning
  the server with the values read back from the user environment: full handshake,
  17 tools including `run-raw-sql`. **Takes effect only in a Claude Code launched
  from a NEW terminal** — a process inherits its parent's environment block, so
  relaunching inside an already-open shell fails the same way. Documented in
  `AGENTS.md`. Real MCP errors live in
  `%LOCALAPPDATA%\claude-cli-nodejs\Cache\<project>\mcp-logs-<server>\*.jsonl` —
  read them instead of guessing.

## Current state

- `npm run lint`, `npm run build`, `check:agents`, `check:sync`, and
  `openspec validate --all --strict` (3 items) all pass.
- **Verified live in the browser** against the signed-in app: all three colour
  bands by computed `background-color` with exact boundaries (71 green / 69
  orange, 53 orange / 49 grey) and no blue; banner reveal with no network
  request; text filter matching company *and* role; High Match = 14, Low Match =
  10; all three sorts reordering; page reset from page 2 on filter change;
  pagination range and disabled edges; empty state and clear; rows carrying no
  anchor and not navigating; hover on the hovered row only; mobile overflow
  contained (doc 334px in a 349px viewport, 900px table in a 269px wrapper).
  Console and server logs clean.
- **Adversarial `/feature-review`: 3 Minor, 0 Critical, 0 Important.** Two fixed
  (the centred `<th scope="row">`; the score bar announcing twice via `role="img"`
  plus the adjacent visible percentage — the bar is now `aria-hidden`). One
  deferred to Feature 10, marked with a comment in `JobsTable.tsx`.
- Committed to `main`. Nothing deployed.
- A dev server may still be running on port 3000 (`preview_start`,
  `jobpilot-dev`).

## Next session starts with

`/opsx-propose` **Feature 10 Adzuna Job Discovery**.

Before writing that route, read the **"Routes that call the AI gateway"**
subsection of `context/code-standards.md` — `maxDuration`, the rate-limit check
(`lib/ai-rate-limit.ts`), and a UI in-flight `useRef` guard are all mandatory,
and each is there because it already cost real money or a real bug. The Find Jobs
button is currently a plain submit with no ref guard: **it becomes a billed
action the moment Feature 10 wires it to the gateway.**

Feature 10 also needs the InsForge MCP. It failed to connect all session, was
diagnosed afterwards, and is **fixed pending a restart from a new terminal** —
see "Problems solved".

## Open questions

- **The empty state's copy assumes filters emptied the list.** With `jobs=[]` it
  still reads "No jobs match the current filters" and renders no Clear button.
  Unreachable while the array is hardcoded; Feature 10's first-ever search with
  zero results lands exactly there. An unfiltered empty list needs "run your
  first search", not "clear filters". Comment marks the spot in `JobsTable.tsx`.
- **Relative dates under client/server clock skew.** Timestamps are computed once
  on the server; the client formats them against its own clock. A viewer more
  than an hour off would hydrate a different label than was rendered. Coarse
  hour/day buckets keep the window small and it is a dev-only warning. Settling
  it needs a deliberately skewed clock, or formatting server-side and passing a
  label.
- **Feature 13 still has no answer for how Stagehand reaches a model.** Stagehand
  builds its own LLM client and cannot call
  `insforge.ai.chat.completions.create`; likely an OpenAI-compatible base URL
  pointed at the gateway. `architecture.md` and `library-docs.md` carry
  placeholders under an UNRESOLVED note. Do not reintroduce `OPENAI_API_KEY`.
- `ai_usage` retention is unhandled — rows outlive their window and nothing
  prunes them. Cleanup statement is in migration `004`'s header comment.
- Extraction still gets work-history dates wrong often enough that
  review-before-save is load-bearing.
- `maxDuration = 120` vs the hosting plan's ceiling — unverified, nothing
  deployed.
- Feature 06 leftovers still open: save-success copy, resume file input not
  resetting after upload, skills/industries tag input not clearing after "Add".
- Refused AI requests return HTTP 200 with `{ success: false }` rather than 429.
  Deliberate, but worth revisiting if those routes get a non-browser caller.
- Cline and Cursor are not installed here; those config trees are unverified.

## Testing notes

- **Verifying a protected route needs the developer to sign in** in the Browser
  pane first — the pane starts with no session.
- **Reset viewport emulation before trusting a click** (see Problems solved).
  `preview_start` → `jobpilot-dev` → navigate to `/find-jobs`.
- Prefer `javascript_tool` + `getComputedStyle` over screenshots for colour and
  layout facts in this pane.
- `assets/CV Pavel Raspopau ….pdf` (121,878 bytes) is the extraction fixture and
  matches what is in storage. **Not committed** — it holds real contact details.
- **Never click Save Profile while testing extraction** — reload instead.
- **The InsForge MCP connects at session start.** When it is down, drive it over
  stdio with the command and env from `.mcp.json` + `.claude/settings.local.json`
  (newline-delimited JSON-RPC: `initialize` → `notifications/initialized` →
  `tools/call`). Each call re-spawns `npx`, so batch SQL into one call and expect
  20–40s per invocation.
- Rebuild the throwaway-tsconfig harness (`jsx: react-jsx`, `paths`, `outDir`
  inside the project) for any PDF change — it is the only cheap way to test the
  renderer outside Next.js.
