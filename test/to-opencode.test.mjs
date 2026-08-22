import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from 'jsonc-parser';
import { claudeAgentToOpenCode, claudeMcpToOpenCode } from '../lib/to-opencode.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cli = path.join(root, 'bin', 'cli.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-movein-to-opencode-'));
const home = path.join(tmp, 'home');
const project = path.join(tmp, 'project');
const globalOpenCode = path.join(home, '.config', 'opencode');

fs.mkdirSync(path.join(home, '.claude', 'skills', 'shared-skill'), { recursive: true });
fs.writeFileSync(path.join(home, '.claude', 'skills', 'shared-skill', 'SKILL.md'), '---\nname: shared-skill\ndescription: Shared skill\n---\nBody\n');
fs.writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), '# Global Claude instructions\n');
fs.mkdirSync(path.join(home, '.claude', 'rules', 'shared'), { recursive: true });
fs.writeFileSync(path.join(home, '.claude', 'rules', 'preferences.md'), '# Personal preferences\n');
fs.writeFileSync(path.join(home, '.claude', 'rules', 'shared', 'workflow.md'), '# Shared workflow\n');
fs.mkdirSync(path.join(home, '.claude', 'commands'), { recursive: true });
fs.writeFileSync(path.join(home, '.claude', 'commands', 'ship.md'), '---\ndescription: Ship a release\n---\nShip $ARGUMENTS safely.\n');
fs.mkdirSync(path.join(home, '.claude', 'agents'), { recursive: true });
fs.writeFileSync(path.join(home, '.claude', 'agents', 'reviewer.md'), '---\nname: reviewer\ndescription: Review changes\ntools: Read, Grep\n---\nReview the diff.\n');
fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({
  mcpServers: {
    github: { command: 'npx', args: ['-y', 'github-mcp'], env: { TOKEN: '${GITHUB_TOKEN}' } },
    existing: { command: 'uvx', args: ['existing'] },
    unsafe: { command: 'unsafe-mcp', env: { TOKEN: 'ghp_abcdefghijklmnopqrst1234' } },
  },
}));

fs.mkdirSync(path.join(project, '.claude', 'commands'), { recursive: true });
fs.mkdirSync(path.join(project, '.claude', 'agents'), { recursive: true });
fs.mkdirSync(path.join(project, '.claude', 'rules'), { recursive: true });
fs.mkdirSync(path.join(project, '.git'), { recursive: true });
fs.writeFileSync(path.join(project, 'CLAUDE.md'), '# Project Claude instructions\n');
fs.writeFileSync(path.join(project, '.claude', 'rules', 'testing.md'), '# Test rules\n');
fs.writeFileSync(path.join(project, '.claude', 'rules', 'api.md'), '---\npaths:\n  - "src/api/**/*.ts"\n---\n# API rules\n');
fs.writeFileSync(path.join(project, '.claude', 'commands', 'test.md'), 'Run tests for $ARGUMENTS.\n');
fs.writeFileSync(path.join(project, '.claude', 'agents', 'planner.md'), '---\ndescription: Plan work\n---\nMake a plan.\n');
fs.writeFileSync(path.join(project, '.mcp.json'), JSON.stringify({
  mcpServers: {
    remote: { type: 'http', url: 'https://mcp.example.com', headers: { Authorization: 'Bearer ${MCP_TOKEN}' } },
  },
}));
const memoryRef = `~/.claude/projects/${project.replace(/[^A-Za-z0-9]/g, '-')}/memory/MEMORY.md`;
const memoryFile = path.join(home, memoryRef.slice(2));
fs.mkdirSync(path.dirname(memoryFile), { recursive: true });
fs.writeFileSync(memoryFile, '# Claude auto memory\n\n- Use npm for this project.\n');

fs.mkdirSync(path.join(globalOpenCode, 'commands'), { recursive: true });
fs.writeFileSync(path.join(globalOpenCode, 'commands', 'ship.md'), 'keep existing command\n');
fs.writeFileSync(path.join(globalOpenCode, 'opencode.jsonc'), [
  '{',
  '  // keep this comment',
  '  "mcp": {',
  '    "existing": { "type": "local", "command": ["keep"] },',
  '  },',
  '}',
  '',
].join('\n'));

const env = { ...process.env, HOME: home, XDG_CONFIG_HOME: path.join(home, '.config') };
const run = (extra = []) => execFileSync(process.execPath, [cli, project, '--from', 'claude', '--to', 'opencode', ...extra], { env, encoding: 'utf8' });

const dry = run();
assert.match(dry, /Claude Code -> OpenCode safe move/);
assert.match(dry, /dry run only/);
assert.match(dry, /skill shared-skill.*OpenCode reads the Claude skill directory directly/);
assert.match(dry, /command \/ship.*already exists/);
assert.match(dry, /MCP unsafe.*plaintext secret detected, not copied/);
assert.match(dry, /source tool permissions need manual review/);
assert.match(dry, /global Claude rules.*reference 2 rule\(s\)/);
assert.match(dry, /project Claude rules.*reference 1 rule\(s\)/);
assert.match(dry, /rule api.*path-scoped Claude rule needs manual review/);
assert.match(dry, /Claude auto memory.*live reference/);
assert.match(dry, /4 rules · 1 memory/);
assert.ok(!fs.existsSync(path.join(globalOpenCode, 'AGENTS.md')), 'dry run must not write global instructions');
assert.ok(!fs.existsSync(path.join(project, 'AGENTS.md')), 'dry run must not write project instructions');
assert.ok(!fs.existsSync(path.join(project, '.opencode', 'commands', 'test.md')), 'dry run must not copy commands');

const applied = run(['--apply']);
assert.match(applied, /moved\. Start OpenCode/);
assert.strictEqual(fs.readFileSync(path.join(globalOpenCode, 'AGENTS.md'), 'utf8'), '# Global Claude instructions\n', 'global instructions available');
assert.strictEqual(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), '# Project Claude instructions\n', 'project instructions available');
assert.strictEqual(fs.readFileSync(path.join(globalOpenCode, 'commands', 'ship.md'), 'utf8'), 'keep existing command\n', 'existing command preserved');
assert.match(fs.readFileSync(path.join(project, '.opencode', 'commands', 'test.md'), 'utf8'), /\$ARGUMENTS/, 'command copied without changing placeholders');
const reviewer = fs.readFileSync(path.join(globalOpenCode, 'agents', 'reviewer.md'), 'utf8');
assert.match(reviewer, /description: "Review changes"/);
assert.match(reviewer, /mode: subagent/);
assert.match(reviewer, /Review the diff/);
assert.ok(!reviewer.includes('tools:'), 'Claude tool list is not guessed into OpenCode permissions');

const globalText = fs.readFileSync(path.join(globalOpenCode, 'opencode.jsonc'), 'utf8');
assert.match(globalText, /keep this comment/, 'JSONC comments preserved');
const globalConfig = parse(globalText);
assert.deepStrictEqual(globalConfig.mcp.existing.command, ['keep'], 'existing MCP preserved');
assert.deepStrictEqual(globalConfig.mcp.github.command, ['npx', '-y', 'github-mcp']);
assert.strictEqual(globalConfig.mcp.github.environment.TOKEN, '{env:GITHUB_TOKEN}');
assert.ok(!globalConfig.mcp.unsafe, 'plaintext secret server not copied');
assert.deepStrictEqual(globalConfig.instructions, [
  '~/.claude/rules/preferences.md',
  '~/.claude/rules/shared/workflow.md',
]);
const projectConfig = JSON.parse(fs.readFileSync(path.join(project, 'opencode.json'), 'utf8'));
assert.strictEqual(projectConfig.mcp.remote.type, 'remote');
assert.strictEqual(projectConfig.mcp.remote.headers.Authorization, 'Bearer {env:MCP_TOKEN}');
assert.deepStrictEqual(projectConfig.instructions, ['.claude/rules/testing.md', memoryRef]);
assert.ok(!projectConfig.instructions.includes('.claude/rules/api.md'), 'path-scoped rules are not over-applied');
assert.ok(fs.readdirSync(globalOpenCode).some((name) => name.startsWith('opencode.jsonc.dsh-movein.') && name.endsWith('.bak')), 'global config backed up');
const manifest = JSON.parse(fs.readFileSync(path.join(globalOpenCode, 'dsh-movein-manifest.json'), 'utf8'));
assert.ok(manifest.at(-1).moved.some((item) => item.kind === 'config' && item.dest.endsWith('opencode.jsonc')));
assert.ok(manifest.at(-1).moved.some((item) => item.kind === 'agent' && item.dest.endsWith('reviewer.md')));
assert.ok(manifest.at(-1).moved.some((item) => item.kind === 'config' && item.label === 'project Claude rules'));

const repeated = run();
assert.match(repeated, /rule preferences.*already references it/);
assert.match(repeated, /Claude auto memory.*already references it/);
assert.deepStrictEqual(parse(fs.readFileSync(path.join(globalOpenCode, 'opencode.jsonc'), 'utf8')).instructions, [
  '~/.claude/rules/preferences.md',
  '~/.claude/rules/shared/workflow.md',
], 'repeated runs do not duplicate rule references');

const converted = claudeAgentToOpenCode('No frontmatter body', 'plain');
assert.match(converted.text, /description: "Claude Code agent plain"/);
assert.match(converted.text, /No frontmatter body/);
assert.deepStrictEqual(claudeMcpToOpenCode({ command: 'npx', args: ['x'], env: { TOKEN: '${TOKEN}' } }, { v2: true }), {
  type: 'local', command: ['npx', 'x'], environment: { TOKEN: '{env:TOKEN}' },
});

const badHome = path.join(tmp, 'bad-home');
const badProject = path.join(tmp, 'bad-project');
fs.mkdirSync(path.join(badHome, '.claude', 'commands'), { recursive: true });
fs.mkdirSync(badProject, { recursive: true });
fs.writeFileSync(path.join(badHome, '.claude', 'commands', 'blocked.md'), 'Must not copy\n');
fs.writeFileSync(path.join(badProject, 'opencode.jsonc'), '{ invalid jsonc');
const blocked = spawnSync(process.execPath, [cli, badProject, '--to', 'opencode', '--apply'], {
  env: { ...process.env, HOME: badHome, XDG_CONFIG_HOME: path.join(badHome, '.config') },
  encoding: 'utf8',
});
assert.strictEqual(blocked.status, 1);
assert.match(blocked.stdout, /invalid OpenCode config blocked every write/);
assert.ok(!fs.existsSync(path.join(badHome, '.config', 'opencode', 'commands', 'blocked.md')), 'parse error blocks command writes too');

const wrongTypeHome = path.join(tmp, 'wrong-type-home');
const wrongTypeProject = path.join(tmp, 'wrong-type-project');
fs.mkdirSync(path.join(wrongTypeProject, '.claude', 'rules'), { recursive: true });
fs.writeFileSync(path.join(wrongTypeProject, '.claude', 'rules', 'keep.md'), '# Keep me\n');
fs.writeFileSync(path.join(wrongTypeProject, 'opencode.json'), '{ "instructions": "keep-existing" }\n');
const wrongType = spawnSync(process.execPath, [cli, wrongTypeProject, '--to', 'opencode', '--apply'], {
  env: { ...process.env, HOME: wrongTypeHome, XDG_CONFIG_HOME: path.join(wrongTypeHome, '.config') },
  encoding: 'utf8',
});
assert.strictEqual(wrongType.status, 1);
assert.match(wrongType.stdout, /instructions must be a string array/);
assert.strictEqual(fs.readFileSync(path.join(wrongTypeProject, 'opencode.json'), 'utf8'), '{ "instructions": "keep-existing" }\n');

const customHome = path.join(tmp, 'custom-memory-home');
const customProject = path.join(tmp, 'custom-memory-project');
fs.mkdirSync(path.join(customHome, '.claude'), { recursive: true });
fs.mkdirSync(path.join(customProject, '.git'), { recursive: true });
fs.writeFileSync(path.join(customHome, '.claude', 'settings.json'), JSON.stringify({ autoMemoryDirectory: '~/shared-memory' }));
fs.mkdirSync(path.join(customHome, 'shared-memory'), { recursive: true });
fs.writeFileSync(path.join(customHome, 'shared-memory', 'MEMORY.md'), '# Custom memory\n');
const custom = spawnSync(process.execPath, [cli, customProject, '--to', 'opencode', '--apply'], {
  env: { ...process.env, HOME: customHome, XDG_CONFIG_HOME: path.join(customHome, '.config') },
  encoding: 'utf8',
});
assert.strictEqual(custom.status, 0);
assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(customProject, 'opencode.json'), 'utf8')).instructions, [
  '~/shared-memory/MEMORY.md',
]);

const worktreeHome = path.join(tmp, 'worktree-memory-home');
const primaryProject = path.join(tmp, 'primary-project');
const worktreeProject = path.join(tmp, 'worktree-project');
const worktreeGitDir = path.join(primaryProject, '.git', 'worktrees', 'probe');
fs.mkdirSync(worktreeGitDir, { recursive: true });
fs.mkdirSync(worktreeProject, { recursive: true });
fs.writeFileSync(path.join(worktreeProject, '.git'), `gitdir: ${worktreeGitDir}\n`);
const sharedMemoryRef = `~/.claude/projects/${primaryProject.replace(/[^A-Za-z0-9]/g, '-')}/memory/MEMORY.md`;
const sharedMemory = path.join(worktreeHome, sharedMemoryRef.slice(2));
fs.mkdirSync(path.dirname(sharedMemory), { recursive: true });
fs.writeFileSync(sharedMemory, '# Shared worktree memory\n');
const worktree = spawnSync(process.execPath, [cli, worktreeProject, '--to', 'opencode', '--apply'], {
  env: { ...process.env, HOME: worktreeHome, XDG_CONFIG_HOME: path.join(worktreeHome, '.config') },
  encoding: 'utf8',
});
assert.strictEqual(worktree.status, 0);
assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(worktreeProject, 'opencode.json'), 'utf8')).instructions, [
  sharedMemoryRef,
]);

const disabledHome = path.join(tmp, 'disabled-memory-home');
const disabledProject = path.join(tmp, 'disabled-memory-project');
fs.mkdirSync(path.join(disabledHome, '.claude'), { recursive: true });
fs.mkdirSync(path.join(disabledProject, '.git'), { recursive: true });
fs.writeFileSync(path.join(disabledHome, '.claude', 'settings.json'), JSON.stringify({ autoMemoryEnabled: false }));
const disabledMemory = path.join(disabledHome, '.claude', 'projects', disabledProject.replace(/[^A-Za-z0-9]/g, '-'), 'memory', 'MEMORY.md');
fs.mkdirSync(path.dirname(disabledMemory), { recursive: true });
fs.writeFileSync(disabledMemory, '# Disabled memory\n');
const disabled = spawnSync(process.execPath, [cli, disabledProject, '--to', 'opencode'], {
  env: { ...process.env, HOME: disabledHome, XDG_CONFIG_HOME: path.join(disabledHome, '.config') },
  encoding: 'utf8',
});
assert.strictEqual(disabled.status, 0);
assert.doesNotMatch(disabled.stdout, /Claude auto memory/);
assert.match(disabled.stdout, /0 memory/);

const unsupported = spawnSync(process.execPath, [cli, project, '--from', 'codex', '--to', 'opencode'], { env, encoding: 'utf8' });
assert.strictEqual(unsupported.status, 1);
assert.match(unsupported.stderr, /currently supports the Claude Code origin only/);

console.log('dsh-movein Claude Code to OpenCode assertions passed');
