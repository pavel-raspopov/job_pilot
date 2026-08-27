#!/usr/bin/env node
/**
 * Sync agent skills and commands from the source of truth into each harness tree.
 *
 * JobPilot is developed in three harnesses that each read a different config
 * directory and none of which read the others:
 *
 *   Claude Code       .claude/skills/      .claude/commands/
 *   Cursor            .cursor/skills/      .cursor/commands/
 *   VS Code + Cline   .clinerules/skills/  .clinerules/workflows/
 *
 * `.agents/skills/` is the single source of truth. This script copies it into
 * all three, so a skill fixed once is live everywhere.
 *
 * The one wrinkle: the OpenSpec skills reference their own entry point by name,
 * and that name differs per harness — `.agents/` says `/openspec-apply-change`
 * (the skill name) while the command files say `/opsx-apply`. That difference is
 * deliberate, not drift. COMMAND_ALIASES below rewrites those references on the
 * way out so every harness tells the user a name that actually works there.
 *
 * Usage:
 *   node scripts/sync-agents.mjs           apply
 *   node scripts/sync-agents.mjs --check   report drift, exit 1 if any (CI-safe)
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const ROOT = process.cwd();
const SOURCE_SKILLS = '.agents/skills';
const CHECK = process.argv.includes('--check');

/** Skills that are native to one harness and must never be synced or deleted. */
const HARNESS_NATIVE = new Set(['task-observer', 'integration-nextjs-app-router', 'impeccable']);

/**
 * Bookkeeping files that describe the source tree itself rather than a skill.
 * `.openspec-target` names which harness the tree belongs to, so copying it
 * would tell every harness it is `.agents/`.
 */
const SOURCE_ONLY = new Set(['.openspec-target']);

/**
 * `/openspec-*-change` is the skill name; `/opsx-*` is the command name. The
 * command exists in every harness, so prefer it in user-facing prompts.
 */
const COMMAND_ALIASES = [
  ['/openspec-apply-change', '/opsx-apply'],
  ['/openspec-archive-change', '/opsx-archive'],
  ['/openspec-update-change', '/opsx-update'],
  ['/openspec-sync-specs', '/opsx-sync'],
  ['/openspec-propose', '/opsx-propose'],
  ['/openspec-explore', '/opsx-explore'],
];

/**
 * Cline has no "skills" concept, and everything under `.clinerules/` is loaded
 * into the system prompt as rules — copying the skill tree there would put
 * ~270KB of always-on context into every session. Cline gets the workflows
 * (its real convention) plus a small rule file that points at `.agents/skills/`
 * for on-demand reading. Hence `skills: null`.
 */
const TARGETS = [
  { name: 'Claude Code', skills: '.claude/skills', commands: '.claude/commands' },
  { name: 'Cursor', skills: '.cursor/skills', commands: '.cursor/commands' },
  { name: 'Cline', skills: null, commands: '.clinerules/workflows' },
];

const COMMAND_SOURCE = '.cursor/commands';

let drift = 0;
const log = [];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** Markdown gets alias rewriting; everything else is copied byte-for-byte. */
function transform(buf, file) {
  if (!file.endsWith('.md')) return buf;
  let text = buf.toString('utf8');
  for (const [skillName, commandName] of COMMAND_ALIASES) {
    text = text.split(skillName).join(commandName);
  }
  return Buffer.from(text, 'utf8');
}

function syncFile(src, dest) {
  const content = transform(readFileSync(src), src);
  const existing = existsSync(dest) ? readFileSync(dest) : null;
  if (existing && existing.equals(content)) return false;

  drift++;
  log.push(`  ${existing ? 'update' : 'create'}  ${relative(ROOT, dest)}`);
  if (!CHECK) {
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, content);
  }
  return true;
}

function syncTree(srcDir, destDir, { prune }) {
  if (!existsSync(srcDir)) return;
  const wanted = new Set();

  for (const src of walk(srcDir)) {
    const rel = relative(srcDir, src);
    const top = rel.split(/[\\/]/)[0];
    if (HARNESS_NATIVE.has(top) || SOURCE_ONLY.has(top)) continue;
    wanted.add(rel);
    syncFile(src, join(destDir, rel));
  }

  // Remove files that no longer exist upstream, but never touch a
  // harness-native skill that legitimately lives only in this tree.
  if (!prune || !existsSync(destDir)) return;
  for (const dest of walk(destDir)) {
    const rel = relative(destDir, dest);
    const top = rel.split(/[\\/]/)[0];
    if (HARNESS_NATIVE.has(top) || SOURCE_ONLY.has(top) || wanted.has(rel)) continue;
    drift++;
    log.push(`  delete  ${relative(ROOT, dest)}`);
    if (!CHECK) rmSync(dest);
  }
}

if (!existsSync(SOURCE_SKILLS)) {
  console.error(`Source of truth missing: ${SOURCE_SKILLS}`);
  process.exit(1);
}

for (const target of TARGETS) {
  log.push(`${target.name}:`);
  const before = drift;
  if (target.skills) syncTree(SOURCE_SKILLS, target.skills, { prune: true });
  syncTree(COMMAND_SOURCE, target.commands, { prune: false });
  if (drift === before) log.push('  up to date');
}

console.log(log.join('\n'));

if (CHECK && drift > 0) {
  console.error(`\n${drift} file(s) out of sync. Run: npm run sync:agents`);
  process.exit(1);
}
console.log(CHECK ? '\nAll harness trees in sync.' : `\nSynced ${drift} file(s).`);
