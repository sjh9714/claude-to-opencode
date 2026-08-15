import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cli = path.join(root, 'bin', 'cli.mjs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-movein-'));
const home = path.join(tmp, 'home');
const project = path.join(tmp, 'proj');

// fixture: fake Claude Code home + project
fs.mkdirSync(path.join(home, '.claude', 'skills', 'my-skill'), { recursive: true });
fs.writeFileSync(path.join(home, '.claude', 'skills', 'my-skill', 'SKILL.md'), '---\nname: my-skill\ndescription: d\n---\nbody');
fs.writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), '# global rules');
fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({
  hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'echo hi' }] }] },
  permissions: { allow: ['Bash(ls:*)'] },
}));
fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({
  mcpServers: { userserver: { command: 'uvx', args: ['server-x'], env: { TOKEN: '${MY_TOKEN}' } } },
}));
fs.mkdirSync(path.join(project, '.claude', 'skills', 'proj-skill'), { recursive: true });
fs.writeFileSync(path.join(project, '.claude', 'skills', 'proj-skill', 'SKILL.md'), '---\nname: proj-skill\ndescription: d\n---\nbody');
fs.writeFileSync(path.join(project, 'CLAUDE.md'), '# proj rules');
fs.writeFileSync(path.join(project, '.mcp.json'), JSON.stringify({
  mcpServers: {
    github: { command: 'npx', args: ['-y', "it's-a-server"] },
    remote: { type: 'http', url: 'https://mcp.example.com', headers: { Authorization: '${AUTH}' } },
  },
}));

// fake dsh profile with both row packages already resolvable (no network install)
for (const pkg of ['@deepseek-ai/dsh-hooks-claude-code', '@deepseek-ai/dsh-hook-protocol', '@deepseek-ai/dsh-mcp-client']) {
  const d = path.join(home, '.dsh', 'profiles', 'web', 'node_modules', pkg);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify({ name: pkg, version: '0.0.0' }));
}

const run = (extra = []) =>
  execFileSync(process.execPath, [cli, project, ...extra], { env: { ...process.env, HOME: home, DSH_HOME: '' }, encoding: 'utf8' });

// 1. dry run writes nothing
const dry = run();
assert.match(dry, /dry run, nothing written/);
assert.match(dry, /3 MCP servers/);
assert.ok(!fs.existsSync(path.join(home, '.dsh', 'cordis.patch.yml')), 'dry run must not write patch');
assert.ok(!fs.existsSync(path.join(home, '.dsh', 'skills')), 'dry run must not link skills');

// 2. apply
const out = run(['--apply']);
assert.match(out, /moved in/);
const dsh = path.join(home, '.dsh');
assert.ok(fs.lstatSync(path.join(dsh, 'AGENTS.md')).isSymbolicLink(), 'global CLAUDE.md linked');
assert.ok(fs.lstatSync(path.join(dsh, 'skills', 'my-skill')).isSymbolicLink(), 'global skill linked');
assert.ok(fs.lstatSync(path.join(project, '.dsh', 'skills', 'proj-skill')).isSymbolicLink(), 'project skill linked');
const patch = fs.readFileSync(path.join(dsh, 'cordis.patch.yml'), 'utf8');
assert.match(patch, /serverName: 'github'/);
assert.match(patch, /'it''s-a-server'/, 'single quotes escaped');
assert.match(patch, /transport: streamable-http/);
assert.match(patch, /TOKEN: !!js process\.env\.MY_TOKEN/, 'env var mapped, secret not inlined');
assert.match(patch, /'@deepseek-ai\/dsh-hooks-claude-code'/);
assert.match(patch, /configPath: '.*settings\.json'/);

// 3. idempotent re-apply: no duplicate block, existing links skipped
fs.writeFileSync(path.join(dsh, 'cordis.patch.yml'), "- insert:\n    - id: user-row\n      name: 'keep-me'\n" + patch);
const out2 = run(['--apply']);
assert.match(out2, /already exists/);
const patch2 = fs.readFileSync(path.join(dsh, 'cordis.patch.yml'), 'utf8');
assert.strictEqual(patch2.match(/>>> dsh-movein/g).length, 1, 'exactly one generated block');
assert.match(patch2, /keep-me/, 'user rows preserved');

// 4. unresolvable package + failing installer: matching rows skipped, error surfaced, other rows kept
{
  const { scan } = await import('../lib/scan.mjs');
  const { planActions, applyActions } = await import('../lib/apply.mjs');
  fs.rmSync(path.join(home, '.dsh', 'profiles', 'web', 'node_modules', '@deepseek-ai', 'dsh-hooks-claude-code'), { recursive: true });
  fs.rmSync(path.join(home, '.dsh', 'cordis.patch.yml'));
  const actions = planActions(scan({ home, project }));
  let installerCalls = 0;
  applyActions(actions, { installer: () => { installerCalls++; return false; } });
  assert.strictEqual(installerCalls, 1, 'installer tried once for missing hooks pkg');
  const patchAction = actions.find((a) => a.label === 'MCP servers + hooks');
  assert.strictEqual(patchAction.status, 'error');
  assert.match(patchAction.note, /dsh-hooks-claude-code/);
  const partial = fs.readFileSync(path.join(home, '.dsh', 'cordis.patch.yml'), 'utf8');
  assert.match(partial, /serverName: 'github'/, 'mcp rows still written');
  assert.ok(!partial.includes('dsh-hooks-claude-code'), 'hooks row NOT written when pkg missing');
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log('ok - all assertions passed');
