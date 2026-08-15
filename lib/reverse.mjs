// Reverse moving day: bring DSH-born assets back to Claude Code (dual boot).
// v1 scope, skills and global instructions. Assets that dsh-movein itself
// symlinked out of .claude are recognized and skipped (they never left).
// DSH-born MCP/hook rows stay put, hand-written cordis patches are not
// machine-reversible without a YAML parser; the report says so.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const exists = (p) => { try { fs.lstatSync(p); return true; } catch { return false; } };

const isLinkInto = (p, dir) => {
  try {
    if (!fs.lstatSync(p).isSymbolicLink()) return false;
    return fs.realpathSync(p).startsWith(fs.realpathSync(dir) + path.sep);
  } catch { return false; }
};

export function scanReverse({ home = os.homedir(), project = process.cwd(), dshHome } = {}) {
  dshHome = dshHome || process.env.DSH_HOME || path.join(home, '.dsh');
  const claudeDir = path.join(home, '.claude');
  const roots = [
    { root: path.join(dshHome, 'skills'), dest: path.join(claudeDir, 'skills'), scope: 'global' },
    { root: path.join(project, '.dsh', 'skills'), dest: path.join(project, '.claude', 'skills'), scope: 'project' },
  ];
  const skills = [];
  for (const r of roots) {
    if (!exists(r.root)) continue;
    for (const e of fs.readdirSync(r.root, { withFileTypes: true })) {
      const p = path.join(r.root, e.name);
      if (!exists(path.join(p, 'SKILL.md'))) continue;
      skills.push({ name: e.name, dir: p, dest: path.join(r.dest, e.name), cameFromClaude: isLinkInto(p, claudeDir) });
    }
  }
  const agentsMd = path.join(dshHome, 'AGENTS.md');
  return {
    home, project, dshHome, claudeDir, skills,
    agentsMd: exists(agentsMd) ? agentsMd : null,
    agentsMdIsOurLink: exists(agentsMd) && isLinkInto(agentsMd, claudeDir),
    claudeMdExists: exists(path.join(claudeDir, 'CLAUDE.md')),
  };
}

export function planReverseActions(scan, { copy = false } = {}) {
  const a = [];
  if (scan.agentsMd) {
    if (scan.agentsMdIsOurLink) {
      a.push({ label: 'AGENTS.md (global)', status: 'skip', note: 'already points into ~/.claude, never left home' });
    } else if (scan.claudeMdExists) {
      a.push({ label: 'AGENTS.md (global)', status: 'skip', note: '~/.claude/CLAUDE.md also exists, merge by hand' });
    } else {
      const dest = path.join(scan.claudeDir, 'CLAUDE.md');
      a.push({
        label: 'AGENTS.md (global)', status: 'move', note: `link ${dest} -> ${scan.agentsMd}`,
        kind: 'instructions', src: scan.agentsMd, dest,
        exec: () => { fs.mkdirSync(scan.claudeDir, { recursive: true }); fs.symlinkSync(scan.agentsMd, dest); },
      });
    }
  }
  for (const s of scan.skills) {
    if (s.cameFromClaude) {
      a.push({ label: `skill ${s.name}`, status: 'skip', note: 'moved in from Claude Code originally, still lives there' });
    } else if (exists(s.dest)) {
      a.push({ label: `skill ${s.name}`, status: 'skip', note: `${s.dest} already exists` });
    } else {
      a.push({
        label: `skill ${s.name}`, status: 'move', note: `${copy ? 'copy' : 'link'} -> ${s.dest}`,
        kind: 'skill', src: s.dir, dest: s.dest,
        exec: () => {
          fs.mkdirSync(path.dirname(s.dest), { recursive: true });
          if (copy) fs.cpSync(s.dir, s.dest, { recursive: true });
          else fs.symlinkSync(s.dir, s.dest);
        },
      });
    }
  }
  return a;
}

export function renderReverseReport(actions, { apply }) {
  const icon = { move: apply ? '✓' : '→', done: '✓', skip: '−', error: '✗' };
  const pad = (s, n) => (s.length >= n ? s : s + ' ' + '.'.repeat(Math.max(0, n - s.length - 2)) + ' ');
  const L = ['', '📦 dsh-movein --reverse · DSH -> Claude Code · dual boot', ''];
  for (const act of actions) L.push(`  ${icon[act.status] || '·'} ${pad(act.label, 34)}${act.note}`);
  if (!actions.length) L.push('  − nothing DSH-born to bring back yet');
  L.push('');
  L.push('  − MCP and hook rows stay in DSH, hand-written cordis patches are not machine-reversible');
  if (!apply) L.push('  dry run, nothing written. Re-run with --reverse --apply.');
  L.push('');
  return L.join('\n');
}
