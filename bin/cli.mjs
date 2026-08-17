#!/usr/bin/env node
import path from 'node:path';
import os from 'node:os';
import { scan } from '../lib/scan.mjs';
import { planActions, applyActions, writeManifest, restoreLatestBackup, emitRules } from '../lib/apply.mjs';
import { renderReport } from '../lib/report.mjs';
import { scanReverse, planReverseActions, renderReverseReport } from '../lib/reverse.mjs';
import { runDoctor, renderDoctor } from '../lib/doctor.mjs';
import { scanCodex } from '../lib/codex.mjs';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`dsh-movein - move your Claude Code setup into DeepSeek Harness (DSH)

Usage: npx dsh-movein [projectDir] [options]

Commands:
  (default)   scan and show the moving estimate, --apply to move in
  doctor      verify a finished move (skills loaded, packages resolvable, matcher case)
  restore     put back the newest cordis.patch.yml backup

Options:
  --apply       actually move (default is a dry run)
  --copy        copy skills instead of symlinking
  --from codex  move a Codex CLI setup instead (~/.codex: AGENTS.md, prompts, MCP servers)
  --reverse     bring DSH-born skills and instructions back to Claude Code (dual boot)
  --emit-rules  print your deny/ask rules in dsh-permission-rules YAML and exit
  -h, --help    this help

Moves: global CLAUDE.md, skills, slash commands, MCP servers (.mcp.json), hooks,
subagents, permission rules. Project CLAUDE.md needs no move, DSH reads it natively.`);
  process.exit(0);
}

const apply = args.includes('--apply');
const copy = args.includes('--copy');
const reverse = args.includes('--reverse');
let from = 'claude';
const fromIdx = args.findIndex((a) => a === '--from' || a.startsWith('--from='));
if (fromIdx !== -1) {
  from = args[fromIdx].includes('=') ? args[fromIdx].split('=')[1] : args[fromIdx + 1];
  if (args[fromIdx] === '--from') args.splice(fromIdx, 2); else args.splice(fromIdx, 1);
  if (!['claude', 'codex'].includes(from)) {
    console.error(`dsh-movein: unknown origin "${from}", supported: claude, codex`);
    process.exit(1);
  }
}
const positionals = args.filter((a) => !a.startsWith('-'));
const command = ['doctor', 'restore'].includes(positionals[0]) ? positionals.shift() : null;
const project = positionals[0] ? path.resolve(positionals[0]) : process.cwd();

if (command === 'doctor') {
  const checks = runDoctor({ project });
  console.log(renderDoctor(checks));
  process.exit(checks.some((c) => c.level === 'bad') ? 1 : 0);
}
if (command === 'restore') {
  const src = restoreLatestBackup(process.env.DSH_HOME || path.join(os.homedir(), '.dsh'));
  console.log(src ? `restored cordis.patch.yml from ${src}` : 'no backups found under ~/.dsh/movein-backups');
  process.exit(src ? 0 : 1);
}
if (args.includes('--emit-rules')) {
  process.stdout.write(emitRules(scan({ project }).permissions));
  process.exit(0);
}

if (reverse) {
  const rev = scanReverse({ project });
  const actions = planReverseActions(rev, { copy });
  if (apply) {
    for (const act of actions) {
      if (act.status !== 'move') continue;
      try { act.exec(); act.status = 'done'; } catch (e) { act.status = 'error'; act.note = String(e.message || e); }
    }
    writeManifest({ dshHome: rev.dshHome, project: rev.project }, actions);
  }
  console.log(renderReverseReport(actions, { apply }));
  process.exit(actions.some((a) => a.status === 'error') ? 1 : 0);
}

const scanResult = from === 'codex' ? scanCodex({ project }) : scan({ project });
const actions = planActions(scanResult, { copy });
if (apply) applyActions(actions, { scanResult });
console.log(renderReport(scanResult, actions, { apply }));
process.exit(actions.some((a) => a.status === 'error') ? 1 : 0);
