#!/usr/bin/env node
import path from 'node:path';
import os from 'node:os';
import { scan } from '../lib/scan.mjs';
import { planActions, applyActions, writeManifest, restoreLatestBackup, emitRules } from '../lib/apply.mjs';
import { renderReport } from '../lib/report.mjs';
import { scanReverse, planReverseActions, renderReverseReport } from '../lib/reverse.mjs';
import { runDoctor, renderDoctor } from '../lib/doctor.mjs';
import { runLiveDoctor } from '../lib/doctor-live.mjs';
import { scanCodex } from '../lib/codex.mjs';
import { scanOpenCode } from '../lib/opencode.mjs';
import { planOpenCodeActions, applyOpenCodeActions, renderOpenCodeReport } from '../lib/to-opencode.mjs';
import { claimStarPrompt } from '../lib/star.mjs';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`dsh-movein - move coding-agent setups safely

Usage: npx dsh-movein [projectDir] [options]

Commands:
  (default)   scan and show the moving estimate, --apply to move in
  doctor      verify a finished move; --live validates DSH, composes it, then boots a safe baseline
  restore     put back the newest cordis.patch.yml backup

Options:
  --apply       actually move (default is a dry run)
  --copy        copy linked files instead of symlinking
  --hooks-only  install only the Claude command-hook bridge for OpenCode
  --from <origin>  claude, codex, opencode
  --to <target>    dsh, opencode (default: dsh)
  --reverse     bring DSH-born skills and instructions back to Claude Code (dual boot)
  --emit-rules  print your deny/ask rules in dsh-permission-rules YAML and exit
  --live        with doctor, validate boot-free dump, compose, and boot a safe official baseline
  -h, --help    this help

Claude Code can move to OpenCode or DSH. Codex and OpenCode can move to DSH.
Memory, instructions, command hooks, skills, commands, agents, MCP servers, and supported settings are handled without overwriting existing destinations.`);
  process.exit(0);
}

const apply = args.includes('--apply');
const copy = args.includes('--copy');
const hooksOnly = args.includes('--hooks-only');
const reverse = args.includes('--reverse');
let from = 'claude';
const fromIdx = args.findIndex((a) => a === '--from' || a.startsWith('--from='));
if (fromIdx !== -1) {
  from = args[fromIdx].includes('=') ? args[fromIdx].split('=')[1] : args[fromIdx + 1];
  if (args[fromIdx] === '--from') args.splice(fromIdx, 2); else args.splice(fromIdx, 1);
  if (!['claude', 'codex', 'opencode'].includes(from)) {
    console.error(`dsh-movein: unknown origin "${from}", supported: claude, codex, opencode`);
    process.exit(1);
  }
}
let to = 'dsh';
const toIdx = args.findIndex((a) => a === '--to' || a.startsWith('--to='));
if (toIdx !== -1) {
  to = args[toIdx].includes('=') ? args[toIdx].split('=')[1] : args[toIdx + 1];
  if (args[toIdx] === '--to') args.splice(toIdx, 2); else args.splice(toIdx, 1);
  if (!['dsh', 'opencode'].includes(to)) {
    console.error(`dsh-movein: unknown target "${to}", supported: dsh, opencode`);
    process.exit(1);
  }
}
const positionals = args.filter((a) => !a.startsWith('-'));
const command = ['doctor', 'restore'].includes(positionals[0]) ? positionals.shift() : null;
const project = positionals[0] ? path.resolve(positionals[0]) : process.cwd();

if (command === 'doctor') {
  const checks = runDoctor({ project });
  let interrupted = null;
  if (args.includes('--live')) {
    const controller = new AbortController();
    const onSigint = () => { interrupted = 'SIGINT'; controller.abort('SIGINT'); };
    const onSigterm = () => { interrupted = 'SIGTERM'; controller.abort('SIGTERM'); };
    process.once('SIGINT', onSigint);
    process.once('SIGTERM', onSigterm);
    try { checks.push(...await runLiveDoctor({ signal: controller.signal })); }
    finally {
      process.removeListener('SIGINT', onSigint);
      process.removeListener('SIGTERM', onSigterm);
    }
  }
  console.log(renderDoctor(checks));
  process.exit(interrupted === 'SIGINT' ? 130 : interrupted === 'SIGTERM' ? 143 : checks.some((c) => c.level === 'bad') ? 1 : 0);
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

if (to === 'opencode') {
  if (from !== 'claude') {
    console.error(`dsh-movein: OpenCode target currently supports the Claude Code origin only`);
    process.exit(1);
  }
  if (reverse || command) {
    console.error(`dsh-movein: --to opencode does not support ${reverse ? '--reverse' : command}`);
    process.exit(1);
  }
  const result = scan({ project });
  const actions = planOpenCodeActions(result, { copy, hooksOnly });
  if (apply) applyOpenCodeActions(actions, result);
  console.log(renderOpenCodeReport(result, actions, { apply, hooksOnly }));
  process.exit(actions.some((action) => action.status === 'error') ? 1 : 0);
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

const scanResult = from === 'codex'
  ? scanCodex({ project })
  : from === 'opencode'
    ? scanOpenCode({ project })
    : scan({ project });
const actions = planActions(scanResult, { copy });
if (apply) applyActions(actions, { scanResult });
const starPrompt = apply && claimStarPrompt(scanResult.dshHome, actions);
console.log(renderReport(scanResult, actions, { apply, starPrompt }));
process.exit(actions.some((a) => a.status === 'error') ? 1 : 0);
