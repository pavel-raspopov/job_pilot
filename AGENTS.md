---
description: Instructions building JobPilot with AI coding assistants
globs: *
alwaysApply: true
---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Stack

- **Framework:** Next.js 16 App Router, React 19, TypeScript strict
- **Styling:** Tailwind CSS v4 with tokens in `app/globals.css` `@theme` — never hardcoded hex or raw Tailwind color classes
- **Backend:** InsForge (auth, Postgres, storage, functions) — not Supabase
- **Analytics:** PostHog
- **Jobs:** Adzuna API

InsForge app code: use InsForge MCP (`fetch-docs` / `fetch-sdk-docs`). Infrastructure (SQL, buckets, functions): the same MCP (`run-raw-sql`, `get-table-schema`, `create-bucket`) or `npx @insforge/cli`. Project patterns: `context/library-docs.md`.

## Environments

This project is developed in three harnesses. Each reads a different config tree; none reads the others.

| Harness | Skills | Commands | MCP |
| --- | --- | --- | --- |
| Claude Code | `.claude/skills/` | `.claude/commands/` | `.mcp.json` |
| Cursor | `.cursor/skills/` | `.cursor/commands/` | `.cursor/mcp.json` |
| VS Code + Cline | `.clinerules/skills/` | `.clinerules/workflows/` | Cline global settings |

`.agents/skills/` is the **single source of truth**. The three trees above are generated copies — `skills-lock.json` records each skill's upstream repo. Edit `.agents/skills/`, then run:

```
npm run sync:agents
```

A skill edited in one harness tree and not synced is live in that harness only. Never hand-edit a generated tree.

`openspec` must be installed globally (`npm i -g @fission-ai/openspec`) on every machine — the `opsx-*` commands call the bare binary, which a devDependency does not put on PATH.

MCP credentials never go in a committed file. `.mcp.json` and `.cursor/mcp.json` reference them as `${VAR}`.

**`${VAR}` in `.mcp.json` expands from Claude Code's own process environment — not from `.claude/settings.local.json`.** The `env` block there is applied to tool execution (Bash sees those variables), but the MCP config interpolator never reads it, so a variable that only exists in `settings.local.json` is passed to the server as the literal string `${VAR}`. That is not a visible failure: the InsForge server calls `new URL("${INSFORGE_API_BASE_URL}/api/health")`, throws `ERR_INVALID_URL`, and exits, so Claude Code just reports `CONNECTION_CLOSED`. It failed this way on 11 of 12 launches between 2026-08-27 and 2026-09-02 while the InsForge web console showed the backend healthy the whole time — the console reports the *backend*, which was never the problem. Exactly one launch (2026-08-27 18:04) connected and ran the Feature 04 migrations; why that one worked is not recoverable, since `.mcp.json` was still untracked until 21:54 that day, so its contents at 18:04 are unknown.

So the MCP variables must exist in the **environment Claude Code is launched from**. On this machine `INSFORGE_API_KEY` and `INSFORGE_API_BASE_URL` are persisted as Windows **user-scope** environment variables (set 2026-09-02); `settings.local.json` keeps its copy for tool-side use. Two consequences worth knowing:

- A process inherits its parent's environment block at spawn time, so a changed user env var reaches Claude Code only after the **whole app is restarted**. On this machine Claude Code runs as the **desktop app** and there is no `claude` on PATH — "open a new terminal and run `claude`" is not the fix here. Close the window, exit it from the hidden-icons tray, and end any surviving task in Task Manager, then start it again. Done that way on 2026-09-02, the server connected and `run-raw-sql` returned live rows.
- When the server will not connect, read the real error rather than guessing: `%LOCALAPPDATA%\claude-cli-nodejs\Cache\<project>\mcp-logs-<server>\*.jsonl`.

### AGENTS.md gets overwritten

InsForge tooling rewrites this file with its own SDK boilerplate when its MCP server starts (the giveaway: `description: Instructions building apps with MCP` in the frontmatter, and a `# InsForge SDK Documentation` heading). If you see that, this file has been clobbered — restore it:

```
npm run check:agents
```

## Session start

1. `/task-observer` — silent observation-log setup
2. `/remember restore` — if continuing prior work
3. `/using-superpowers` — route to the skill below

## Context loading (tiered)

Do not read every `context/` file by default. Do not read them "just in case."

| When | Read |
| --- | --- |
| Any implementation | `context/progress-tracker.md` and the **current feature section** of `context/build-plan.md` |
| Structure, API, or DB | also `context/architecture.md` and `context/library-docs.md` |
| UI | also `context/ui-tokens.md`, `context/ui-rules.md`, `context/ui-registry.md` |
| Implementation review | also `context/code-standards.md` |
| Ambiguous requirements | also `context/project-overview.md` (scope / out-of-scope) |

Sub-agents: same rules. Report back in 3–5 bullets (what changed, files, verification). Stop after 2–3 search attempts and ask rather than scanning the whole repo.

## Feature workflow

OpenSpec owns agree-before-build, implement, and archive. Do not also run `/brainstorming`, `/writing-plans`, or `/executing-plans` unless the user explicitly asks for Superpowers plans.

```
/opsx-explore (optional) → /opsx-propose → /opsx-apply
  → /imprint if new UI
  → verification-before-completion (lint + build + manual; show output)
  → /feature-review
  → /opsx-archive
  → /remember save before git commit
```

`/architect` runs **inside** explore/propose for language alignment and source reconciliation (build-plan vs design vs product scope). It is not a second plan format. `/impeccable shape` is for open visual decisions only.

Do not back-fill `openspec/specs/` from the 17-feature build-plan. Specs grow from real changes.

This repo has **no test runner**. Verify with `npm run lint`, `npm run build`, and a manual click-through. Do not add a test framework unasked.

## Skill routing

One job each. If two skills seem to apply, this table wins.

- `/opsx-explore` — think through an area before committing to a change
- `/opsx-propose` — write proposal, delta specs, design, and tasks under `openspec/changes/`
- `/opsx-apply` — implement the change's `tasks.md`
- `/opsx-archive` — merge specs and archive the change
- `/architect` — source reconciliation and language alignment during explore/propose
- `/impeccable <command>` — visual design (`init`, `shape`, `document`, `polish`, …)
- `/imprint` — after any new UI component, write `context/ui-registry.md`. After first real UI (or a major visual-system change), pair with `/impeccable document`
- `/feature-review` — 3-layer review after apply, before archive. Prefer this over Bugbot / Security Review when the user asks for a "review"
- `/test-driven-development` — only when a test runner exists; otherwise follow the plan's lint/build/manual verify
- `/verification-before-completion` — before claiming done; show command output
- `/systematic-debugging` — bugs and unexpected behavior; root cause first
- `/recover` — after one failed correction loop; Failure Mode 1 then invokes systematic-debugging
- `/remember save` — end of session **and always before a git commit** (include `memory.md`). See `.cursor/rules/memory-before-commit.mdc`
- `/remember restore` — returning after a multi-session feature
- `/using-superpowers` — skill discovery at session start
- `/task-observer` — start of every task-oriented session; log skill-improvement observations
- PostHog App Router — `.claude/skills/integration-nextjs-app-router`

## Rules that never change

- Never use hardcoded hex values or raw Tailwind color classes — tokens from `context/ui-tokens.md`
- Update `context/progress-tracker.md` and `context/ui-registry.md` after every feature
- Before any third-party library: load its installed skill first, then `context/library-docs.md`
- If the same problem persists after one corrective prompt — stop and run `/recover`
- Never persist secrets (keys, tokens, connection strings) in `memory.md`, git, or logs
- Run `/remember save` **before** every git commit and stage `memory.md` with the work — never leave memory for a follow-up commit
- **Before producing any artifact type for the first time in a session, look at how this repo already does it.** Match the repo, not your own recent output — the strongest pull on style is whatever you most recently wrote, and in a long run that is your own prose, not the project's conventions. Make it a concrete check, not a good intention: commit message → `git log -8 --format=%B`; new component → read a sibling in the same directory; new API route → read an existing one end to end; new doc entry → read its neighbours; migration → read the last one. This is cheap and catches the whole class of drift, including conventions the docs never state and contradictions between docs (`lib/adzuna.ts` vs `agent/adzuna.ts` was on disk to be found)
- **Commit messages are one line.** `type(scope): summary`, 72 characters or fewer, plus the `Co-Authored-By` trailer. **No body, ever.** The reasoning, decisions and verification already live in `context/progress-tracker.md`, `memory.md` and the archived OpenSpec change — three places that get updated as the project moves on, while a commit body is frozen the moment it is written and starts lying. Duplicating them into git history makes `git log` unreadable without making anything more discoverable. If a change feels too big to summarise in one line, that is a signal the commit is too big, not that the message is too short
- Edit skills in `.agents/skills/` and run `npm run sync:agents` — never hand-edit `.claude/`, `.cursor/`, or `.clinerules/`
- If this file starts with `# InsForge SDK Documentation`, it was overwritten — run `npm run check:agents` before doing anything else

## InsForge SDK notes

Condensed from the boilerplate InsForge tooling writes over this file. Kept here so the useful parts survive the next clobbering — and so the parts that are **wrong for this project** are recorded as wrong rather than silently re-applied.

### Fetching InsForge docs

Before writing InsForge integration code, pull current docs rather than working from training data:

- `fetch-docs <type>` — `instructions`, `db-sdk-typescript`, `auth-sdk-typescript`, `auth-components-nextjs`, `storage-sdk`, `functions-sdk`, `ai-integration-sdk`, `real-time`, `payments`, `deployment`
- `fetch-sdk-docs <feature> <language>` — feature is `db` / `auth` / `storage` / `functions` / `ai` / `realtime` / `payments`; language is `typescript` for this project

### SDK or MCP

| Use the SDK for | Use MCP for |
| --- | --- |
| Auth, database CRUD, storage, AI calls, invoking functions | Schema (`run-raw-sql`, `get-table-schema`), buckets (`create-bucket`, `list-buckets`), deploying functions, `get-backend-metadata` |

App logic never reaches for MCP; infrastructure never goes through the SDK.

### Gotchas that cost real time

- Every SDK call returns `{ data, error }` — check `error`, never assume `data`
- Inserts take an **array**: `.insert([{ … }])`
- Serverless functions expose **one endpoint** each; no nested route paths
- `storage.upload(path, file)` takes `File | Blob`, not a Node `Buffer`
- The `resumes` bucket is **private** — a stored url is a record, not a fetchable link; reads go through `createSignedUrl`
- The SDK's HTTP client defaults to a **30s timeout**, too short for a model call — AI routes use `lib/insforge-ai.ts` (120s) and must also `export const maxDuration`

### Boilerplate claims that are wrong here

When this file gets overwritten, these come back. All four are wrong for JobPilot:

| Boilerplate says | Actually |
| --- | --- |
| "Use Tailwind CSS 3.4, do not upgrade to v4" | This project is **Tailwind v4** with tokens in `app/globals.css` `@theme` |
| "Call OpenRouter directly with a server-side `OPENROUTER_API_KEY`" | All AI goes through the **InsForge AI gateway** (`insforge.ai.chat.completions.create`). There is no `OPENROUTER_API_KEY`, and none is needed — Feature 07 |
| "`download-template` is the MANDATORY FIRST STEP" | Only for new projects. This one exists |
| `createClient()` setup snippets | Already done: `lib/insforge-client.ts`, `lib/insforge-server.ts`, `lib/insforge-ai.ts` |
