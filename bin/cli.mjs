#!/usr/bin/env node
import path from 'node:path';
import { scan } from '../lib/scan.mjs';
import { planActions, applyActions, writeManifest } from '../lib/apply.mjs';
import { renderReport } from '../lib/report.mjs';
import { scanReverse, planReverseActions, renderReverseReport } from '../lib/reverse.mjs';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`dsh-movein - move your Claude Code setup into DeepSeek Harness (DSH)

Usage: npx dsh-movein [projectDir] [options]

Options:
  --apply     actually move (default is a dry run)
  --copy      copy skills instead of symlinking
  --reverse   bring DSH-born skills and instructions back to Claude Code (dual boot)
  -h, --help  this help

Moves: global CLAUDE.md, skills, MCP servers (.mcp.json), hooks.
Project CLAUDE.md needs no move, DSH reads it natively.`);
  process.exit(0);
}

const apply = args.includes('--apply');
const copy = args.includes('--copy');
const reverse = args.includes('--reverse');
const projectArg = args.find((a) => !a.startsWith('-'));
const project = projectArg ? path.resolve(projectArg) : process.cwd();

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

const scanResult = scan({ project });
const actions = planActions(scanResult, { copy });
if (apply) applyActions(actions, { scanResult });
console.log(renderReport(scanResult, actions, { apply }));
process.exit(actions.some((a) => a.status === 'error') ? 1 : 0);
