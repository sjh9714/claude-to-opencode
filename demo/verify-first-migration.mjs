// Real migration-engine demo using only synthetic files in an owned temp root.
// No DSH host, model request, plugin install, user hook, or GitHub action runs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { scan } from '../lib/scan.mjs';
import { planActions, applyActions, backupPatch, restoreLatestBackup } from '../lib/apply.mjs';

const demoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-movein-first-run-'));
const fixtureHome = path.join(demoRoot, 'source-home');
const fixtureProject = path.join(demoRoot, 'project');
const fixtureDsh = path.join(demoRoot, 'target-dsh');
const snapshot = (dir) => {
  const files = {};
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files[`${entry.name}/`] = 'directory';
      for (const [name, digest] of Object.entries(snapshot(file))) {
        files[path.join(entry.name, name)] = digest;
      }
    } else {
      assert.ok(entry.isFile(), 'the copy-only demo must not create symlinks');
      files[entry.name] = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    }
  }
  return files;
};
const put = (relative, content) => {
  const file = path.join(demoRoot, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};
const skill = (name, description) => `---\nname: ${name}\ndescription: '${description}'\n---\nSynthetic example; never run a command.\n`;
const inspect = () => scan({ home: fixtureHome, project: fixtureProject, dshHome: fixtureDsh });

try {
  put('source-home/.claude/CLAUDE.md', '# Synthetic source instructions\n');
  put('source-home/.claude/skills/review-checklist/SKILL.md', skill('review-checklist', 'Source checklist'));
  put('source-home/.claude/skills/commit-notes/SKILL.md', skill('commit-notes', 'Summarize a diff'));
  put('source-home/.claude/projects/synthetic/session.jsonl', '{"synthetic":"source transcript placeholder"}\n');
  put('project/CLAUDE.md', '# Synthetic project instructions\n');
  put('project/.claude/skills/frontend-check/SKILL.md', skill('frontend-check', 'Check a small UI change'));
  put('target-dsh/AGENTS.md', '# Keep the existing target instructions\n');
  put('target-dsh/skills/review-checklist/SKILL.md', skill('review-checklist', 'Keep the existing checklist'));
  put('target-dsh/sessions/synthetic/session.jsonl', '{"synthetic":"existing session placeholder"}\n');

  const sourceBefore = snapshot(fixtureHome);
  const projectSourceBefore = snapshot(path.join(fixtureProject, '.claude'));
  const projectInstructionsBefore = fs.readFileSync(path.join(fixtureProject, 'CLAUDE.md'), 'utf8');
  const existingInstructions = fs.readFileSync(path.join(fixtureDsh, 'AGENTS.md'), 'utf8');
  const existingSkill = fs.readFileSync(path.join(fixtureDsh, 'skills/review-checklist/SKILL.md'), 'utf8');
  const sessionsBefore = snapshot(path.join(fixtureDsh, 'sessions'));
  const beforePreview = snapshot(demoRoot);
  const scanned = inspect();
  assert.equal(scanned.sessionCount, 1, 'source transcripts are counted, not imported');
  const actions = planActions(scanned, { copy: true });
  assert.deepEqual(snapshot(demoRoot), beforePreview, 'preview must not write any files');
  assert.equal(actions.filter((a) => a.status === 'move').length, 2);
  assert.equal(actions.filter((a) => a.status === 'skip').length, 2);
  assert.equal(actions.filter((a) => a.status === 'native').length, 1);
  console.log('1. 预演：2 个待搬技能，2 个已有目标保留；没有写入。');

  applyActions(actions, {
    scanResult: scanned,
    installer: () => { throw new Error('This demo must not install packages'); },
  });
  assert.equal(actions.filter((a) => a.status === 'done').length, 2);
  assert.equal(actions.filter((a) => a.status === 'error').length, 0);
  assert.deepEqual(snapshot(path.join(fixtureDsh, 'sessions')), sessionsBefore, 'existing sessions must remain unchanged');
  for (const [source, destination] of [
    [path.join(fixtureHome, '.claude/skills/commit-notes/SKILL.md'), path.join(fixtureDsh, 'skills/commit-notes/SKILL.md')],
    [path.join(fixtureProject, '.claude/skills/frontend-check/SKILL.md'), path.join(fixtureProject, '.dsh/skills/frontend-check/SKILL.md')],
  ]) {
    assert.deepEqual(fs.readFileSync(destination), fs.readFileSync(source));
  }
  assert.equal(fs.readFileSync(path.join(fixtureDsh, 'AGENTS.md'), 'utf8'), existingInstructions);
  assert.equal(fs.readFileSync(path.join(fixtureDsh, 'skills/review-checklist/SKILL.md'), 'utf8'), existingSkill);
  assert.deepEqual(snapshot(fixtureHome), sourceBefore, 'source home must remain unchanged');
  assert.deepEqual(snapshot(path.join(fixtureProject, '.claude')), projectSourceBefore);
  assert.equal(fs.readFileSync(path.join(fixtureProject, 'CLAUDE.md'), 'utf8'), projectInstructionsBefore);
  const manifest = JSON.parse(fs.readFileSync(path.join(fixtureDsh, 'movein-manifest.json'), 'utf8'));
  assert.equal(manifest.length, 1);
  assert.equal(manifest[0].moved.length, 2);
  console.log('2. 应用：2 个技能内容逐字节一致；已有目标和来源文件未改动。');

  const beforeRepeat = snapshot(demoRoot);
  const repeated = planActions(inspect(), { copy: true });
  assert.equal(repeated.filter((a) => a.status === 'move').length, 0);
  assert.equal(repeated.filter((a) => a.status === 'skip').length, 4);
  assert.deepEqual(snapshot(demoRoot), beforeRepeat, 'repeated preview must not write');
  console.log('3. 再预演：0 个待搬项目；没有重复写入。');

  put('source-home/.claude/skills/commit-notes/SKILL.md', skill('commit-notes', 'Changed after the copy'));
  const beforeChangedSource = snapshot(demoRoot);
  const changedScan = inspect();
  const changedActions = planActions(changedScan, { copy: true });
  assert.equal(changedActions.filter((a) => a.status === 'move').length, 0);
  assert.equal(changedActions.filter((a) => a.status === 'skip').length, 4);
  applyActions(changedActions, {
    scanResult: changedScan,
    installer: () => { throw new Error('This demo must not install packages'); },
  });
  assert.deepEqual(snapshot(demoRoot), beforeChangedSource, 'repeated copy apply must not synchronize a changed source');
  console.log('4. 来源技能改变后再应用：已有副本不覆盖；会话占位文件未改动。');

  put('target-dsh/cordis.patch.yml', '# Synthetic patch before a change\n');
  const patchKey = path.join('target-dsh', 'cordis.patch.yml');
  const originalPatchDigest = snapshot(demoRoot)[patchKey];
  const backup = backupPatch(fixtureDsh);
  assert.ok(backup);
  put('target-dsh/cordis.patch.yml', '# Synthetic patch after a change\n');
  const beforeRestore = snapshot(demoRoot);
  assert.equal(restoreLatestBackup(fixtureDsh), backup);
  assert.deepEqual(snapshot(demoRoot), { ...beforeRestore, [patchKey]: originalPatchDigest }, 'restore must change only the patch file');
  console.log('5. 恢复：只还原 cordis.patch.yml；技能、清单、来源和会话占位文件保留。');
} finally {
  fs.rmSync(demoRoot, { recursive: true, force: false });
  assert.equal(fs.existsSync(demoRoot), false);
  console.log('清理：仅删除本次创建的临时目录。');
}
