# JobPilot — agent contract

**Read `AGENTS.md` at the repo root first.** It is the shared contract for every
harness this project is developed in (Claude Code, Cursor, VS Code + Cline) and
holds the stack, the tiered context-loading rules, the feature workflow, the
skill routing table, and the rules that never change. This file does not repeat
it — it only tells you where things live in Cline specifically.

If `AGENTS.md` starts with `# InsForge SDK Documentation`, it has been
overwritten by InsForge tooling. Run `npm run check:agents` to restore it before
doing anything else.

## Skills

Skills are **not** loaded into your context automatically. They live in
`.agents/skills/<name>/SKILL.md` — the source of truth for all three harnesses.
Read one on demand when the routing table in `AGENTS.md` sends you there, the
same way you would read any other file.

Do not edit a skill under `.claude/` or `.cursor/`; those are generated copies.
Edit `.agents/skills/`, then run `npm run sync:agents`.

## Workflows

The OpenSpec commands are Cline workflows in `.clinerules/workflows/`, invoked
as `/opsx-explore`, `/opsx-propose`, `/opsx-apply`, `/opsx-archive`,
`/opsx-sync`, `/opsx-update`. They shell out to the `openspec` binary, which
must be installed globally on this machine:

```
npm i -g @fission-ai/openspec
```

## MCP

Cline stores MCP servers in its own global settings, not in the repo. Mirror
what `.mcp.json` declares — `insforge` (`npx -y @insforge/mcp`, needs `API_KEY`
and `API_BASE_URL`) and `posthog` (`https://mcp.posthog.com/mcp`, bearer token).
Keep the credentials in Cline's settings, never in a committed file.

## Verification

No test runner. Verify with `npm run lint`, `npm run build`, and a manual
click-through. Show the output. Do not add a test framework unasked.
