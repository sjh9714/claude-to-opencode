import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cli = path.join(root, 'packages', 'claude-to-opencode', 'bin', 'cli.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-to-opencode-'));
const home = path.join(tmp, 'home');
const project = path.join(tmp, 'project');
fs.mkdirSync(path.join(project, '.claude', 'rules'), { recursive: true });
fs.mkdirSync(path.join(project, '.git'), { recursive: true });
fs.writeFileSync(path.join(project, '.claude', 'rules', 'testing.md'), '# Testing rule\n');
const memory = path.join(home, '.claude', 'projects', project.replace(/[^A-Za-z0-9]/g, '-'), 'memory', 'MEMORY.md');
fs.mkdirSync(path.dirname(memory), { recursive: true });
fs.writeFileSync(memory, '# Claude auto memory\n');

const env = { ...process.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: path.join(home, '.config') };
const dry = spawnSync(process.execPath, [cli, project], { env, encoding: 'utf8' });
assert.strictEqual(dry.status, 0);
assert.match(dry.stdout, /claude-to-opencode · Claude Code/);
assert.doesNotMatch(dry.stdout, /📦 dsh-movein/);
assert.match(dry.stdout, /Claude Code -> OpenCode safe move/);
assert.match(dry.stdout, /project Claude rules/);
assert.match(dry.stdout, /Claude auto memory/);
assert.match(dry.stdout, /dry run only/);
assert.ok(!fs.existsSync(path.join(project, 'opencode.json')), 'alias stays dry by default');

fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({
  hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'check.sh' }] }] },
}));
const hooksOnly = spawnSync(process.execPath, [cli, project, '--hooks-only'], { env, encoding: 'utf8' });
assert.strictEqual(hooksOnly.status, 0);
assert.match(hooksOnly.stdout, /Claude hooks -> OpenCode guardrails/);
assert.match(hooksOnly.stdout, /found 1 supported command hooks/);
assert.doesNotMatch(hooksOnly.stdout, /project Claude rules/);

const help = spawnSync(process.execPath, [cli, '--help'], { env, encoding: 'utf8' });
assert.strictEqual(help.status, 0);
assert.match(help.stdout, /npx claude-to-opencode/);

const wrongRoute = spawnSync(process.execPath, [cli, '--to', 'dsh'], { env, encoding: 'utf8' });
assert.strictEqual(wrongRoute.status, 1);
assert.match(wrongRoute.stderr, /usage is npx claude-to-opencode/);

fs.rmSync(tmp, { recursive: true, force: true });
console.log('claude-to-opencode alias assertions passed');
