import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { filterScanResult, runMovein } from '../shell/routes.mjs';
import { installerCommand } from '../lib/apply.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-movein-ui-'));
const home = path.join(tmp, 'home');
const project = path.join(tmp, 'project');
const dshHome = path.join(home, '.dsh');
fs.mkdirSync(path.join(home, '.claude', 'skills', 'probe'), { recursive: true });
fs.mkdirSync(project, { recursive: true });
fs.writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), '# global');
fs.writeFileSync(path.join(home, '.claude', 'skills', 'probe', 'SKILL.md'), '---\nname: probe\ndescription: probe\n---\nbody\n');
fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({
  hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'echo ready' }] }] },
  permissions: { deny: ['Bash(rm:*)'] },
}));

const filtered = filterScanResult({
  globalClaudeMd: 'global', projectClaudeMd: 'project',
  skills: { global: [1], project: [2] }, commands: { global: [1], project: [] }, inlineCommands: [1],
  agents: { global: [1], project: [] }, inlineAgents: [1], hookConfigs: [1],
  permissionRules: 1, permissions: { deny: ['x'], ask: [] }, mcpServers: [1],
}, ['skills']);
assert.strictEqual(filtered.globalClaudeMd, null);
assert.deepStrictEqual(filtered.skills.global, [1]);
assert.deepStrictEqual(filtered.commands, { global: [], project: [] });
assert.deepStrictEqual(filtered.hookConfigs, []);
assert.deepStrictEqual(filtered.permissions, { deny: [], ask: [] });

const options = { home, dshHome };
const preview = runMovein({ project, include: ['skills'] }, options);
assert.strictEqual(preview.applied, false);
assert.strictEqual(preview.actions.length, 1);
assert.match(preview.actions[0].label, /skill probe/);
assert.ok(!fs.existsSync(path.join(dshHome, 'skills')), 'preview writes nothing');

const applied = runMovein({ project, apply: true, include: ['skills'] }, options);
assert.strictEqual(applied.ok, true);
assert.strictEqual(applied.starPrompt, true);
assert.ok(fs.existsSync(path.join(dshHome, 'skills', 'probe', 'SKILL.md')));
assert.ok(fs.existsSync(path.join(dshHome, '.dsh-movein-star-prompted')));
assert.match(applied.report, /Star it at https:\/\/github\.com\/sjh9714\/dsh-movein/);

const repeated = runMovein({ project, apply: true, include: ['skills'] }, options);
assert.strictEqual(repeated.starPrompt, false, 'star prompt appears once');

const fakeDshBin = path.join(tmp, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
fs.mkdirSync(path.dirname(fakeDshBin), { recursive: true });
fs.writeFileSync(fakeDshBin, '');
const direct = installerCommand('web', 'probe-package', '1.2.3', fakeDshBin);
assert.strictEqual(direct.file, process.execPath);
assert.deepStrictEqual(direct.args.slice(1), ['plugin', '--profile', 'web', 'add', 'probe-package@1.2.3']);

const client = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
assert.match(client, /window\.__ModuleLoader__\.load\(/);
let registered;
const require = createRequire(import.meta.url);
vm.runInNewContext(client, {
  window: { __ModuleLoader__: { load(spec) { registered = { id: spec.id, exports: spec.factory(require) }; } } },
  console,
});
assert.strictEqual(registered.id, 'dsh-movein');
assert.strictEqual(typeof registered.exports.apply, 'function');
assert.deepStrictEqual(Array.from(registered.exports.inject), ['slots', 'locale']);

console.log('settings UI tests passed');
