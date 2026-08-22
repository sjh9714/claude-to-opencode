import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { inspectOpenCodeHookBridge, renderOpenCodeHookPlugin } from '../lib/opencode-hook-plugin.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-to-opencode-hooks-'));
const project = path.join(tmp, 'project');
const claudeRoot = path.join(tmp, 'claude');
const pre = path.join(tmp, 'pre.mjs');
const post = path.join(tmp, 'post.mjs');
const pluginFile = path.join(tmp, 'claude-hooks.mjs');
const subdirectory = path.join(project, 'src');

fs.mkdirSync(path.join(project, '.claude'), { recursive: true });
fs.mkdirSync(path.join(project, '.git'), { recursive: true });
fs.mkdirSync(subdirectory, { recursive: true });
fs.mkdirSync(claudeRoot, { recursive: true });
fs.writeFileSync(pre, `
let input = '';
for await (const chunk of process.stdin) input += chunk;
const data = JSON.parse(input);
if (data.tool_input.command === 'rm -rf /') {
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'destructive command blocked' } }));
} else if (data.tool_input.command === 'rewrite me') {
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: { command: 'npm test' } } }));
} else if (data.tool_input.command === 'check root') {
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: { command: process.env.CLAUDE_PROJECT_DIR } } }));
}
`);
fs.writeFileSync(post, `
let input = '';
for await (const chunk of process.stdin) input += chunk;
const data = JSON.parse(input);
if (data.tool_input.file_path === 'bad.js') {
  console.error('lint failed');
  process.exit(2);
}
console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: 'lint passed' } }));
`);

const settings = {
  hooks: {
    PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: process.execPath, args: [pre] }] }],
    PostToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command: process.execPath, args: [post] }] }],
    Stop: [{ hooks: [{ type: 'command', command: process.execPath, args: [post] }] }],
  },
};
fs.writeFileSync(path.join(project, '.claude', 'settings.json'), JSON.stringify(settings));

const summary = inspectOpenCodeHookBridge([{ settings }]);
assert.deepStrictEqual(summary, { supported: 2, skipped: 1, unsupportedEvents: ['Stop'] });

fs.writeFileSync(pluginFile, renderOpenCodeHookPlugin());
const module = await import(`${pathToFileURL(pluginFile).href}?test=${Date.now()}`);
const hooks = await module.ClaudeCodeHooks({ directory: subdirectory });

const safe = { args: { command: 'npm test' } };
await hooks['tool.execute.before']({ tool: 'bash', sessionID: 's1', callID: 'c1' }, safe);
assert.deepStrictEqual(safe.args, { command: 'npm test' });

const rewritten = { args: { command: 'rewrite me', extra: true } };
await hooks['tool.execute.before']({ tool: 'bash', sessionID: 's1', callID: 'c2' }, rewritten);
assert.deepStrictEqual(rewritten.args, { command: 'npm test' });

const rooted = { args: { command: 'check root' } };
await hooks['tool.execute.before']({ tool: 'bash', sessionID: 's1', callID: 'c-root' }, rooted);
assert.deepStrictEqual(rooted.args, { command: project });

await assert.rejects(
  hooks['tool.execute.before']({ tool: 'bash', sessionID: 's1', callID: 'c3' }, { args: { command: 'rm -rf /' } }),
  /destructive command blocked/,
);

const goodOutput = { title: 'edit', output: 'changed', metadata: {} };
await hooks['tool.execute.after']({ tool: 'edit', sessionID: 's1', callID: 'c4', args: { file_path: 'good.js' } }, goodOutput);
assert.match(goodOutput.output, /lint passed/);

const badOutput = { title: 'edit', output: 'changed', metadata: {} };
await hooks['tool.execute.after']({ tool: 'edit', sessionID: 's1', callID: 'c5', args: { file_path: 'bad.js' } }, badOutput);
assert.match(badOutput.output, /lint failed/);

fs.rmSync(tmp, { recursive: true, force: true });
console.log('ok - Claude command hooks bridge into OpenCode');
