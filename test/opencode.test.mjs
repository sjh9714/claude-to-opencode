import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanOpenCode } from '../lib/opencode.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-movein-opencode-'));
const home = path.join(tmp, 'home');
const project = path.join(tmp, 'project');
const globalRoot = path.join(home, '.config', 'opencode');
const customFile = path.join(tmp, 'custom.jsonc');
const customRoot = path.join(tmp, 'custom-root');

const write = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};
const skill = (root, dir, name) => write(path.join(root, dir, name, 'SKILL.md'), `---\nname: ${name}\ndescription: d\n---\nbody\n`);

write(path.join(globalRoot, 'opencode.jsonc'), `{
  // comments and trailing commas are valid
  "agent": { "review": { "description": "global", "prompt": "global prompt" } },
  "command": { "ship": { "description": "global", "template": "global command" } },
  "mcp": {
    "shared": { "type": "local", "command": ["npx", "global-server"] },
    "disabled": { "type": "local", "command": ["npx", "off"], "enabled": false },
  },
  "instructions": ["GLOBAL.md"],
  "permission": { "bash": "ask" },
  "plugin": ["global-plugin"],
  "skills": { "paths": ["extra-skills"], "urls": ["https://example.com/skill"] },
}`);
write(path.join(globalRoot, 'GLOBAL.md'), '# global instruction');
skill(globalRoot, 'skills', 'global-skill');
skill(globalRoot, 'skill', 'legacy-skill');
skill(globalRoot, 'extra-skills', 'configured-skill');
write(path.join(globalRoot, 'agents', 'file-agent.md'), '---\ndescription: file agent\n---\nfile prompt\n');
write(path.join(globalRoot, 'commands', 'file-command.md'), '---\ndescription: file command\n---\nfile body\n');

write(customFile, `{
  "agent": { "review": { "description": "custom", "prompt": "custom prompt" } },
  "command": { "ship": { "description": "custom", "template": "custom command" } },
  "mcp": { "shared": { "type": "local", "command": ["bun", "custom-server"] } },
}`);
skill(customRoot, 'skills', 'custom-skill');
write(path.join(customRoot, 'agent', 'custom-agent.md'), '---\ndescription: custom agent\n---\ncustom\n');
write(path.join(customRoot, 'command', 'custom-command.md'), 'custom command');

write(path.join(project, 'opencode.jsonc'), `{
  "agent": { "review": { "description": "project", "prompt": "project prompt" } },
  "commands": { "ship": { "description": "project", "template": "project command" } },
  "mcp": {
    "shared": {
      "type": "local",
      "command": ["npx", "-y", "project-server"],
      "environment": { "TOKEN": "{env:PROJECT_TOKEN}", "FILE": "{file:token.txt}" },
    },
    "remote": {
      "type": "remote",
      "url": "https://mcp.example.com",
      "headers": { "Authorization": "Bearer {env:MCP_TOKEN}" },
    },
    "broken": { "type": "local", "command": [] },
    "badArgs": { "type": "local", "command": ["npx", 7] },
    "badEnv": { "type": "local", "command": ["npx", "server"], "environment": [] },
    "badHeaders": { "type": "remote", "url": "https://bad.example.com", "headers": [] },
  },
}`);
write(path.join(project, 'AGENTS.md'), '# native project rules');
skill(path.join(project, '.opencode'), 'skills', 'project-skill');
skill(path.join(project, '.opencode'), 'skill', 'project-legacy-skill');
write(path.join(project, '.opencode', 'agents', 'project-agent.md'), '---\ndescription: project agent\n---\nproject\n');
write(path.join(project, '.opencode', 'commands', 'project-command.md'), 'project command');

const result = scanOpenCode({
  home,
  project,
  env: {
    OPENCODE_CONFIG: customFile,
    OPENCODE_CONFIG_DIR: customRoot,
  },
});

assert.deepStrictEqual(result.errors, []);
assert.strictEqual(result.origin, 'OpenCode');
assert.strictEqual(result.projectClaudeMd, path.join(project, 'AGENTS.md'));
assert.strictEqual(result.globalClaudeMd, path.join(globalRoot, 'GLOBAL.md'));

assert.deepStrictEqual(result.skills.global.map((x) => x.name).sort(), [
  'configured-skill', 'custom-skill', 'global-skill', 'legacy-skill',
]);
assert.deepStrictEqual(result.skills.project.map((x) => x.name).sort(), [
  'project-legacy-skill', 'project-skill',
]);
assert.deepStrictEqual(result.agents.global.map((x) => path.basename(x)).sort(), ['custom-agent.md', 'file-agent.md']);
assert.deepStrictEqual(result.agents.project.map((x) => path.basename(x)), ['project-agent.md']);
assert.deepStrictEqual(result.commands.global.map((x) => path.basename(x)).sort(), ['custom-command.md', 'file-command.md']);
assert.deepStrictEqual(result.commands.project.map((x) => path.basename(x)), ['project-command.md']);

assert.strictEqual(result.inlineAgents.length, 1);
assert.strictEqual(result.inlineAgents[0].name, 'review');
assert.strictEqual(result.inlineAgents[0].cfg.prompt, 'project prompt', 'project agent wins');
assert.strictEqual(result.inlineCommands.length, 1);
assert.strictEqual(result.inlineCommands[0].cfg.template, 'project command', 'project command wins');

const shared = result.mcpServers.find((x) => x.name === 'shared');
assert.deepStrictEqual(shared.cfg, {
  command: 'npx',
  args: ['-y', 'project-server'],
  env: { TOKEN: '{env:PROJECT_TOKEN}', FILE: '{file:token.txt}' },
});
const remote = result.mcpServers.find((x) => x.name === 'remote');
assert.deepStrictEqual(remote.cfg, {
  type: 'streamable-http',
  url: 'https://mcp.example.com',
  headers: { Authorization: 'Bearer {env:MCP_TOKEN}' },
});
assert.ok(!result.mcpServers.some((x) => x.name === 'disabled'));
assert.ok(!result.mcpServers.some((x) => x.name === 'broken'));
assert.ok(!result.mcpServers.some((x) => ['badArgs', 'badEnv', 'badHeaders'].includes(x.name)));

const notices = result.notices.map((x) => x.message).join('\n');
assert.match(notices, /disabled MCP disabled/);
assert.match(notices, /malformed MCP broken/);
assert.match(notices, /malformed MCP badArgs/);
assert.match(notices, /malformed MCP badEnv/);
assert.match(notices, /malformed MCP badHeaders/);
assert.match(notices, /URL skill source/);
assert.match(notices, /OpenCode permissions/);
assert.match(notices, /OpenCode plugins/);
assert.match(notices, /sessions.*out of scope/i);

const bad = path.join(tmp, 'bad.jsonc');
write(bad, '{ "mcp": {, } }');
const broken = scanOpenCode({ home, project, env: { OPENCODE_CONFIG: bad } });
assert.strictEqual(broken.errors.length, 1);
assert.strictEqual(broken.errors[0].file, bad);

const layeredHome = path.join(tmp, 'layered-home');
const repo = path.join(tmp, 'repo');
const nested = path.join(repo, 'packages', 'app');
const layeredCustom = path.join(tmp, 'layered-custom.jsonc');
const layeredDir = path.join(tmp, 'layered-dir');
write(path.join(repo, '.git', 'HEAD'), 'ref: refs/heads/main\n');
write(path.join(repo, 'opencode.json'), '{ "agent": { "layered": { "prompt": "root" } } }');
write(path.join(repo, '.opencode', 'opencode.jsonc'), '{ "agent": { "layered": { "prompt": "root dotdir" } } }');
write(path.join(nested, 'opencode.jsonc'), '{ "agent": { "layered": { "prompt": "nested" } } }');
write(path.join(nested, '.opencode', 'opencode.json'), '{ "agent": { "layered": { "prompt": "nested dotdir" } } }');
write(layeredCustom, '{ "agent": { "layered": { "prompt": "custom" } } }');
write(path.join(layeredDir, 'opencode.json'), '{ "agent": { "layered": { "prompt": "custom dir" } } }');
const layered = scanOpenCode({
  home: layeredHome,
  project: nested,
  env: { OPENCODE_CONFIG: layeredCustom, OPENCODE_CONFIG_DIR: layeredDir },
});
assert.strictEqual(layered.inlineAgents.find((x) => x.name === 'layered').cfg.prompt, 'nested dotdir');
assert.ok(layered.configs.some((x) => x.file === path.join(repo, 'opencode.json')));
assert.ok(layered.configs.some((x) => x.file === path.join(nested, '.opencode', 'opencode.json')));

const rulesHome = path.join(tmp, 'rules-home');
const rulesRoot = path.join(rulesHome, '.config', 'opencode');
write(path.join(rulesRoot, 'AGENTS.md'), '# global rules');
const oneRule = scanOpenCode({ home: rulesHome, project: path.join(tmp, 'rules-project'), env: {} });
assert.strictEqual(oneRule.globalClaudeMd, path.join(rulesRoot, 'AGENTS.md'));
write(path.join(rulesRoot, 'opencode.json'), '{ "instructions": ["EXTRA.md"] }');
write(path.join(rulesRoot, 'EXTRA.md'), '# extra rules');
const multipleRules = scanOpenCode({ home: rulesHome, project: path.join(tmp, 'rules-project'), env: {} });
assert.strictEqual(multipleRules.globalClaudeMd, null);
assert.match(multipleRules.notices.map((x) => x.message).join('\n'), /instructions need manual review/);

fs.rmSync(tmp, { recursive: true, force: true });
console.log('ok - OpenCode scanner assertions passed');
