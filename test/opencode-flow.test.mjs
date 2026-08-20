import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cli = path.join(root, 'bin', 'cli.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-movein-opencode-flow-'));
const home = path.join(tmp, 'home');
const project = path.join(tmp, 'project');
const globalRoot = path.join(home, '.config', 'opencode');
const dshHome = path.join(home, '.dsh');

const write = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};
const run = (args, extraEnv = {}) => spawnSync(process.execPath, [cli, ...args], {
  env: { ...process.env, HOME: home, DSH_HOME: '', ...extraEnv },
  encoding: 'utf8',
});

write(path.join(globalRoot, 'opencode.jsonc'), `{
  "instructions": ["GLOBAL.md"],
  "agent": { "reviewer": { "description": "Global reviewer", "prompt": "Review carefully" } },
  "command": { "release": { "description": "Global release", "template": "Run tests and release" } },
  "mcp": { "shared": { "type": "local", "command": ["npx", "global-server"] } },
  "permission": { "bash": "ask" },
  "plugin": ["demo-plugin"],
}`);
write(path.join(globalRoot, 'GLOBAL.md'), '# global OpenCode rules');
write(path.join(globalRoot, 'skills', 'global-skill', 'SKILL.md'), '---\nname: global-skill\ndescription: d\n---\nbody\n');

write(path.join(project, 'opencode.jsonc'), `{
  "agent": { "reviewer": { "description": "Project reviewer", "prompt": "Project review prompt" } },
  "commands": { "release": { "description": "Project release", "template": "Project release command" } },
  "mcp": {
    "shared": {
      "type": "local",
      "command": ["npx", "-y", "project-server"],
      "environment": { "TOKEN": "{env:PROJECT_TOKEN}", "FILE": "{file:secret.txt}" },
    },
    "remote": {
      "type": "remote",
      "url": "https://mcp.example.com",
      "headers": { "Authorization": "Bearer {env:MCP_TOKEN}" },
    },
    "env-command": {
      "type": "local",
      "command": ["{env:MCP_BIN}", "--token={env:ARG_TOKEN}"],
    },
    "disabled": { "type": "local", "command": ["npx", "off"], "enabled": false },
  },
}`);
write(path.join(project, 'AGENTS.md'), '# project OpenCode rules');
write(path.join(project, '.opencode', 'agents', 'file-agent.md'), '---\ndescription: File agent\n---\nFile agent prompt\n');
write(path.join(project, '.opencode', 'commands', 'file-command.md'), 'File command body\n');
write(path.join(project, '.opencode', 'skills', 'project-skill', 'SKILL.md'), '---\nname: project-skill\ndescription: d\n---\nbody\n');

write(path.join(project, '.dsh', 'skills', 'project-skill', 'SKILL.md'), 'keep existing\n');
const mcpPkg = path.join(dshHome, 'profiles', 'web', 'node_modules', '@deepseek-ai', 'dsh-mcp-client');
write(path.join(mcpPkg, 'package.json'), JSON.stringify({ name: '@deepseek-ai/dsh-mcp-client', version: '0.0.0' }));

const help = run(['--help']);
assert.strictEqual(help.status, 0);
assert.match(help.stdout, /move agent setups into DeepSeek Harness/);
assert.match(help.stdout, /--from <origin>.*claude, codex, opencode/);

const unknown = run([project, '--from', 'other']);
assert.strictEqual(unknown.status, 1);
assert.match(unknown.stderr, /supported.*claude, codex, opencode/);

const dry = run([project, '--from', 'opencode']);
assert.strictEqual(dry.status, 0, dry.stderr);
assert.match(dry.stdout, /OpenCode -> DeepSeek Harness moving estimate/);
assert.match(dry.stdout, /AGENTS\.md \(project\).*DSH reads it natively/);
assert.match(dry.stdout, /instruction \(global\)/);
assert.match(dry.stdout, /agent reviewer.*convert to skill/);
assert.match(dry.stdout, /command \/release.*convert to user-invocable skill/);
assert.match(dry.stdout, /disabled MCP disabled/);
assert.match(dry.stdout, /OpenCode permissions are unsupported/);
assert.match(dry.stdout, /OpenCode plugins are unsupported/);
assert.match(dry.stdout, /sessions are out of scope/);
assert.match(dry.stdout, /skill project-skill.*already exists/);
assert.ok(!fs.existsSync(path.join(dshHome, 'AGENTS.md')), 'dry run does not link instructions');
assert.ok(!fs.existsSync(path.join(dshHome, 'cordis.patch.yml')), 'dry run does not write patch');
assert.strictEqual(fs.readFileSync(path.join(project, '.dsh', 'skills', 'project-skill', 'SKILL.md'), 'utf8'), 'keep existing\n');

const applied = run([project, '--from', 'opencode', '--apply']);
assert.strictEqual(applied.status, 0, applied.stderr + applied.stdout);
assert.match(applied.stdout, /moved in/);
assert.strictEqual(fs.readlinkSync(path.join(dshHome, 'AGENTS.md')), path.join(globalRoot, 'GLOBAL.md'));
assert.ok(fs.lstatSync(path.join(dshHome, 'skills', 'global-skill')).isSymbolicLink());
assert.strictEqual(fs.readFileSync(path.join(project, '.dsh', 'skills', 'project-skill', 'SKILL.md'), 'utf8'), 'keep existing\n');

const reviewer = fs.readFileSync(path.join(project, '.dsh', 'skills', 'reviewer', 'SKILL.md'), 'utf8');
assert.match(reviewer, /Project reviewer/);
assert.match(reviewer, /Project review prompt/);
assert.match(reviewer, /OpenCode agent/);
const release = fs.readFileSync(path.join(project, '.dsh', 'skills', 'release', 'SKILL.md'), 'utf8');
assert.match(release, /Project release command/);
assert.match(release, /OpenCode command/);
assert.match(fs.readFileSync(path.join(project, '.dsh', 'skills', 'file-agent', 'SKILL.md'), 'utf8'), /File agent prompt/);
assert.match(fs.readFileSync(path.join(project, '.dsh', 'skills', 'file-command', 'SKILL.md'), 'utf8'), /File command body/);

const patch = fs.readFileSync(path.join(dshHome, 'cordis.patch.yml'), 'utf8');
assert.match(patch, /serverName: 'shared'/);
assert.match(patch, /command: 'npx'/);
assert.match(patch, /args: \['-y', 'project-server'\]/);
assert.match(patch, /TOKEN: !!js process\.env\.PROJECT_TOKEN/);
assert.match(patch, /FILE: '\{file:secret\.txt\}'/);
assert.match(patch, /transport: streamable-http/);
assert.match(patch, /url: 'https:\/\/mcp\.example\.com'/);
assert.match(patch, /process\.env\.MCP_TOKEN/);
assert.match(patch, /command: !!js process\.env\.MCP_BIN/);
assert.match(patch, /args: \[!!js `--token=\$\{process\.env\.ARG_TOKEN\}`\]/);
assert.ok(!patch.includes('serverName: \'disabled\''));

const badHome = path.join(tmp, 'bad-home');
const badProject = path.join(tmp, 'bad-project');
write(path.join(badHome, '.config', 'opencode', 'opencode.jsonc'), '{ "mcp": {, } }');
write(path.join(badProject, '.opencode', 'skills', 'must-not-move', 'SKILL.md'), '---\nname: must-not-move\ndescription: d\n---\nbody\n');
const bad = spawnSync(process.execPath, [cli, badProject, '--from', 'opencode', '--apply'], {
  env: { ...process.env, HOME: badHome, DSH_HOME: '' },
  encoding: 'utf8',
});
assert.strictEqual(bad.status, 1);
assert.match(bad.stdout, /opencode\.jsonc/);
assert.match(bad.stdout, /dry run|nothing written|blocked/i);
assert.ok(!fs.existsSync(path.join(badHome, '.dsh')), 'parse error apply writes nothing globally');
assert.ok(!fs.existsSync(path.join(badProject, '.dsh')), 'parse error apply writes nothing in project');

const emptyHome = path.join(tmp, 'empty-home');
const empty = spawnSync(process.execPath, [cli, path.join(tmp, 'empty-project'), '--from', 'opencode'], {
  env: { ...process.env, HOME: emptyHome, DSH_HOME: '' },
  encoding: 'utf8',
});
assert.strictEqual(empty.status, 0);
assert.match(empty.stdout, /~\/.config\/opencode/);
assert.doesNotMatch(empty.stdout, /~\/.claude/);

fs.rmSync(tmp, { recursive: true, force: true });
console.log('ok - OpenCode migration flow assertions passed');
