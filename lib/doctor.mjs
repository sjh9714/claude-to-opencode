// Post-migration health check: did what we moved actually land, load, and
// stay loadable? Answers the migration half of the ecosystem's doctor demand.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { riskyFrontmatter, deadHooks } from './scan.mjs';
import { packageResolvable, HOOKS_PKGS, MCP_PKGS, PERMS_PKGS } from './apply.mjs';

const exists = (p) => { try { fs.lstatSync(p); return true; } catch { return false; } };

export function runDoctor({ home = os.homedir(), project = process.cwd(), dshHome, profile = 'web' } = {}) {
  dshHome = dshHome || process.env.DSH_HOME || path.join(home, '.dsh');
  const checks = [];
  const ok = (label, note = '') => checks.push({ level: 'ok', label, note });
  const warn = (label, note) => checks.push({ level: 'warn', label, note });
  const bad = (label, note) => checks.push({ level: 'bad', label, note });

  // 1. manifest destinations still exist
  const manifestPath = path.join(dshHome, 'movein-manifest.json');
  if (exists(manifestPath)) {
    let missing = 0, total = 0;
    try {
      for (const run of JSON.parse(fs.readFileSync(manifestPath, 'utf8'))) {
        for (const m of run.moved) { total++; if (!exists(m.dest)) missing++; }
      }
    } catch { warn('manifest', `${manifestPath} unreadable`); }
    if (missing) bad('moved assets', `${missing}/${total} recorded destinations no longer exist`);
    else if (total) ok('moved assets', `${total} recorded destinations all present`);
  } else {
    warn('manifest', 'no movein-manifest.json, nothing moved yet or moved by an older version');
  }

  // 2. skills in DSH roots that DSH's YAML parser would silently drop
  for (const root of [path.join(dshHome, 'skills'), path.join(project, '.dsh', 'skills')]) {
    if (!exists(root)) continue;
    for (const e of fs.readdirSync(root)) {
      const dir = path.join(root, e);
      if (!exists(path.join(dir, 'SKILL.md'))) continue;
      const risk = riskyFrontmatter(dir);
      if (risk) bad(`skill ${e}`, risk);
    }
  }
  if (!checks.some((c) => c.label.startsWith('skill '))) ok('skill frontmatter', 'no silent-drop candidates found');

  // 3. patch block packages still resolvable (unresolvable = fatal boot)
  const patch = path.join(dshHome, 'cordis.patch.yml');
  if (exists(patch)) {
    const text = fs.readFileSync(patch, 'utf8');
    for (const [needle, pkgs] of [["'@deepseek-ai/dsh-mcp-client'", MCP_PKGS], ["'@deepseek-ai/dsh-hooks-claude-code'", HOOKS_PKGS], ["'dsh-movein-permissions'", PERMS_PKGS]]) {
      if (!text.includes(needle)) continue;
      for (const pkg of pkgs) {
        if (packageResolvable(dshHome, profile, pkg)) ok(`package ${pkg}`, 'resolvable');
        else bad(`package ${pkg}`, 'referenced in cordis.patch.yml but NOT resolvable, dsh will fail to boot');
      }
    }
  }

  // 4. hooks that silently never run: bad matcher case (#582), unbridged
  // events, non-command types (the split-off half of #582 nobody built)
  for (const file of [path.join(home, '.claude', 'settings.json'), path.join(project, '.claude', 'settings.json')]) {
    let settings = null;
    try { settings = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
    for (const groups of Object.values(settings.hooks ?? {})) {
      for (const g of groups ?? []) {
        const m = g?.matcher;
        if (typeof m === 'string' && /^(Bash|Read|Write|Edit)\b/.test(m)) {
          warn('hook matcher', `"${m}" in ${file} will not match DSH's lowercase tool names (#582), write it lowercase`);
        }
      }
    }
    for (const d of deadHooks([{ scope: file, settings }])) {
      warn(`hook ${d.event}`, `${d.why} (${file})`);
    }
  }

  // 5. AGENTS.md link health
  const agents = path.join(dshHome, 'AGENTS.md');
  if (exists(agents)) {
    try { fs.statSync(agents); ok('AGENTS.md', 'readable'); }
    catch { bad('AGENTS.md', 'broken symlink, global instructions are gone'); }
  }

  checks.push({ level: 'note', label: 'reminder', note: 'DSH snapshots the skill catalog per session, open a NEW session to see newly moved skills' });
  return checks;
}

export function renderDoctor(checks) {
  const icon = { ok: '✓', warn: '⚠', bad: '✗', note: '○' };
  const L = ['', '📦 dsh-movein doctor', ''];
  for (const c of checks) L.push(`  ${icon[c.level]} ${c.label}${c.note ? `, ${c.note}` : ''}`);
  L.push('');
  return L.join('\n');
}
