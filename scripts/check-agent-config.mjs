#!/usr/bin/env node
/**
 * Detect and repair agent config that InsForge tooling overwrote.
 *
 * When the InsForge MCP server starts it rewrites two files in place, with no
 * warning and no error:
 *
 *   AGENTS.md   replaced wholesale with its own SDK boilerplate, destroying the
 *               stack notes, tiered context rules, feature workflow, skill
 *               routing table, and the rules that never change.
 *   .mcp.json   the `${INSFORGE_API_KEY}` placeholder replaced with the literal
 *               admin key, and API_BASE_URL rewritten to whichever project the
 *               local InsForge tooling is currently pointed at.
 *
 * The second one is the dangerous one: `.mcp.json` is meant to be committed, so
 * a plaintext admin key lands one `git add -A` away from the remote.
 *
 * Usage:
 *   node scripts/check-agent-config.mjs           repair what it can
 *   node scripts/check-agent-config.mjs --check   report only, exit 1 on problems
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const CHECK = process.argv.includes('--check');
let problems = 0;
let repaired = 0;

// ---------------------------------------------------------------------------
// AGENTS.md
// ---------------------------------------------------------------------------
const AGENTS = 'AGENTS.md';
/**
 * Present in the InsForge boilerplate, absent from the JobPilot contract.
 *
 * Line-anchored on purpose: AGENTS.md documents this very failure mode and
 * quotes both markers inline, so a substring match would flag the file's own
 * warning text as evidence of the thing it warns about.
 */
const FOREIGN = [
  { label: '# InsForge SDK Documentation heading', re: /^# InsForge SDK Documentation/m },
  { label: 'InsForge frontmatter description', re: /^description: Instructions building apps with MCP/m },
];
/** Present in the JobPilot contract, absent from the boilerplate. */
const EXPECTED = ['## Skill routing', '## Rules that never change', '## Session start'];

function checkAgentsMd() {
  if (!existsSync(AGENTS)) {
    problems++;
    console.error(`${AGENTS} is missing entirely.`);
    return;
  }
  const text = readFileSync(AGENTS, 'utf8');
  const foreign = FOREIGN.filter((m) => m.re.test(text)).map((m) => m.label);
  const missing = EXPECTED.filter((m) => !text.includes(m));
  if (!foreign.length && !missing.length) {
    console.log(`${AGENTS}: intact`);
    return;
  }

  problems++;
  console.error(`${AGENTS}: OVERWRITTEN`);
  if (foreign.length) console.error(`  foreign markers: ${foreign.join(', ')}`);
  if (missing.length) console.error(`  missing sections: ${missing.join(', ')}`);
  if (CHECK) return;

  // Only restore when HEAD holds a good copy, or we swap one broken file for another.
  const head = execFileSync('git', ['show', `HEAD:${AGENTS}`], { encoding: 'utf8' });
  if (EXPECTED.some((m) => !head.includes(m))) {
    console.error(`  HEAD:${AGENTS} is also damaged — not restoring.`);
    console.error(`  Recover manually: git log --oneline -- ${AGENTS}`);
    return;
  }
  execFileSync('git', ['checkout', 'HEAD', '--', AGENTS]);
  repaired++;
  console.error(`  restored from HEAD (re-apply any uncommitted edits, then commit)`);
}

// ---------------------------------------------------------------------------
// .mcp.json — must never hold literal credentials
// ---------------------------------------------------------------------------
const MCP_FILES = ['.mcp.json', '.cursor/mcp.json'];
const SECRET = /\b(ik_|anon_|phx_|phc_|sk-)[A-Za-z0-9_-]{16,}/;
/** env var each field must reference instead of a literal value. */
const PLACEHOLDERS = { API_KEY: '${INSFORGE_API_KEY}', API_BASE_URL: '${INSFORGE_API_BASE_URL}' };

function checkMcpFile(file) {
  if (!existsSync(file)) return;
  const raw = readFileSync(file, 'utf8');
  if (!SECRET.test(raw)) {
    console.log(`${file}: no literal credentials`);
    return;
  }

  problems++;
  console.error(`${file}: CONTAINS A LITERAL CREDENTIAL`);
  if (CHECK) return;

  const json = JSON.parse(raw);
  const env = json?.mcpServers?.insforge?.env;
  if (!env) {
    console.error('  could not locate mcpServers.insforge.env — fix by hand.');
    return;
  }
  for (const [key, placeholder] of Object.entries(PLACEHOLDERS)) {
    if (env[key] && SECRET.test(env[key])) {
      console.error(`  ${key}: literal value replaced with ${placeholder}`);
      console.error('  -> put the real value in .claude/settings.local.json (gitignored)');
    }
    if (env[key]) env[key] = placeholder;
  }
  writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
  repaired++;
  console.error('  rewritten with placeholders. Consider rotating the exposed key.');
}

checkAgentsMd();
for (const f of MCP_FILES) checkMcpFile(f);

if (problems === 0) {
  console.log('\nAgent config is clean.');
  process.exit(0);
}
if (CHECK) {
  console.error(`\n${problems} problem(s). Run: npm run fix:agents`);
  process.exit(1);
}
console.error(`\n${problems} problem(s) found, ${repaired} repaired.`);
process.exit(repaired === problems ? 0 : 1);
