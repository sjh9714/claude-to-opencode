#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const help = args.includes('--help') || args.includes('-h');

if (help) {
  console.log(`claude-to-opencode

Safely preview and move Claude Code memory, setup, and command hooks into OpenCode.

Usage: npx claude-to-opencode [projectDir] [--apply] [--copy]

Options:
  --apply   write the reviewed changes
  --copy    copy instruction files instead of linking them
  -h, --help

The default run is a dry run. The implementation is maintained in dsh-movein.`);
  process.exit(0);
}

const allowed = new Set(['--apply', '--copy']);
const unknown = args.find((arg) => arg.startsWith('-') && !allowed.has(arg));
const positionals = args.filter((arg) => !arg.startsWith('-'));
if (unknown || positionals.length > 1) {
  console.error('claude-to-opencode: usage is npx claude-to-opencode [projectDir] [--apply] [--copy]');
  process.exit(1);
}

const require = createRequire(import.meta.url);
const checkoutEntry = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'bin', 'cli.mjs');
let entry = existsSync(checkoutEntry) ? checkoutEntry : undefined;
if (!entry) {
  try {
    entry = join(dirname(require.resolve('dsh-movein/package.json')), 'bin', 'cli.mjs');
  } catch {
    throw new Error('dsh-movein is not installed');
  }
}

const result = spawnSync(process.execPath, [entry, ...args, '--from=claude', '--to=opencode'], {
  stdio: 'inherit',
  windowsHide: true,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
