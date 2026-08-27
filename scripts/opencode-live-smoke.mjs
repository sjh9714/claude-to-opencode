import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cli = path.join(root, 'bin', 'cli.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-movein-opencode-live-'));
const home = path.join(tmp, 'home');
const project = path.join(tmp, 'project');
const configHome = path.join(home, '.config');

const write = (file, contents) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
};
const env = {
  ...process.env,
  HOME: home,
  USERPROFILE: home,
  XDG_CONFIG_HOME: configHome,
  XDG_DATA_HOME: path.join(home, '.local', 'share'),
  XDG_CACHE_HOME: path.join(home, '.cache'),
  XDG_STATE_HOME: path.join(home, '.local', 'state'),
  OPENCODE_DISABLE_AUTOUPDATE: '1',
  CLAUDE_CONFIG_DIR: path.join(home, '.claude'),
};

function run(command, args, cwd = project) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
  });
  assert.strictEqual(
    result.status,
    0,
    `${command} ${args.join(' ')} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  return result.stdout;
}

try {
  write(path.join(project, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  write(path.join(home, '.claude', 'CLAUDE.md'), '# global-live-rule\n');
  write(path.join(project, 'CLAUDE.md'), '# project-live-rule\n');
  write(path.join(home, '.claude', 'skills', 'live-skill', 'SKILL.md'), [
    '---',
    'name: live-skill',
    'description: OpenCode live compatibility probe',
    '---',
    'Use the live compatibility probe.',
    '',
  ].join('\n'));
  write(path.join(home, '.claude', 'commands', 'live-command.md'), [
    '---',
    'description: Live command probe',
    '---',
    'Print the fixed word live-command.',
    '',
  ].join('\n'));
  write(path.join(home, '.claude', 'agents', 'live-reviewer.md'), [
    '---',
    'description: Live reviewer probe',
    '---',
    'Return the fixed word live-reviewer.',
    '',
  ].join('\n'));
  write(path.join(home, '.claude', 'settings.json'), JSON.stringify({
    hooks: {
      PreToolUse: [{
        matcher: 'Bash',
        hooks: [{ type: 'command', command: 'node', args: ['-e', 'process.exit(0)'] }],
      }],
    },
  }, null, 2));

  const migrated = run(process.execPath, [cli, project, '--to', 'opencode', '--apply'], root);
  assert.match(migrated, /moved\. Start OpenCode/);
  assert.match(fs.readFileSync(path.join(configHome, 'opencode', 'AGENTS.md'), 'utf8'), /global-live-rule/);
  assert.match(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), /project-live-rule/);

  const opencode = process.env.OPENCODE_BIN || (process.platform === 'win32' ? 'opencode.exe' : 'opencode');
  assert.match(run(opencode, ['--version']).trim(), /^1\.18\.23$/);

  const config = run(opencode, ['debug', 'config']);
  assert.match(config, /live-command/);
  assert.match(config, /claude-hooks\.js/);

  const skills = run(opencode, ['debug', 'skill']);
  assert.match(skills, /live-skill/);

  const agent = run(opencode, ['debug', 'agent', 'live-reviewer']);
  assert.match(agent, /Live reviewer probe/);
  assert.match(agent, /live-reviewer/);

  console.log('ok - OpenCode 1.18.23 loaded migrated config, skill, command, agent, and hook plugin');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
