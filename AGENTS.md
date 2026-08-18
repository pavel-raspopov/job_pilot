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

InsForge app code: use InsForge MCP (`fetch-docs` / `fetch-sdk-docs`) and `~/.claude/skills/insforge`. Infrastructure (SQL, buckets, functions): `insforge-cli`. Project patterns: `context/library-docs.md`.

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
