import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const exists = (p) => {
  try { fs.statSync(p); return true; } catch { return false; }
};

const readJson = (p) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
};

const listSkillDirs = (root) => {
  if (!exists(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((e) => (e.isDirectory() || e.isSymbolicLink()) && exists(path.join(root, e.name, 'SKILL.md')))
    .map((e) => ({ name: e.name, dir: path.join(root, e.name) }));
};

const listAgentFiles = (dir) => {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => path.join(dir, f));
};

const hookEventCount = (settings) =>
  settings && settings.hooks ? Object.keys(settings.hooks).length : 0;

const permissionRuleCount = (settings) => {
  const p = settings && settings.permissions;
  if (!p) return 0;
  return (p.allow?.length || 0) + (p.deny?.length || 0) + (p.ask?.length || 0);
};

const mergedPermissions = (settingsList) => {
  const out = { deny: [], ask: [] };
  for (const s of settingsList) {
    for (const k of ['deny', 'ask']) {
      for (const r of s?.permissions?.[k] ?? []) if (!out[k].includes(r)) out[k].push(r);
    }
  }
  return out;
};

const collectMcpServers = (obj, scope, sourcePath) => {
  const servers = obj && obj.mcpServers ? obj.mcpServers : {};
  return Object.entries(servers).map(([name, cfg]) => ({ name, cfg, scope, sourcePath }));
};

export function scan({ home = os.homedir(), project = process.cwd(), dshHome } = {}) {
  const claudeDir = path.join(home, '.claude');
  dshHome = dshHome || process.env.DSH_HOME || path.join(home, '.dsh');
  const projClaudeDir = path.join(project, '.claude');

  const globalSettings = readJson(path.join(claudeDir, 'settings.json'));
  const projSettings = readJson(path.join(projClaudeDir, 'settings.json'));
  const projLocalSettings = readJson(path.join(projClaudeDir, 'settings.local.json'));

  const hookConfigs = [
    { scope: 'global', file: path.join(claudeDir, 'settings.json'), settings: globalSettings },
    { scope: 'project', file: path.join(projClaudeDir, 'settings.json'), settings: projSettings },
    { scope: 'project-local', file: path.join(projClaudeDir, 'settings.local.json'), settings: projLocalSettings },
  ].map((h) => ({ ...h, events: hookEventCount(h.settings) }))
    .filter((h) => h.events > 0);

  const mcpServers = [
    ...collectMcpServers(readJson(path.join(project, '.mcp.json')), 'project', path.join(project, '.mcp.json')),
    ...collectMcpServers(readJson(path.join(home, '.claude.json')), 'user', path.join(home, '.claude.json')),
  ];

  let sessionCount = 0;
  const projectsDir = path.join(claudeDir, 'projects');
  if (exists(projectsDir)) {
    for (const d of fs.readdirSync(projectsDir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      sessionCount += fs.readdirSync(path.join(projectsDir, d.name)).filter((f) => f.endsWith('.jsonl')).length;
    }
  }

  return {
    home, project, dshHome, claudeDir,
    globalClaudeMd: exists(path.join(claudeDir, 'CLAUDE.md')) ? path.join(claudeDir, 'CLAUDE.md') : null,
    dshGlobalAgentsMd: exists(path.join(dshHome, 'AGENTS.md')),
    projectClaudeMd: exists(path.join(project, 'CLAUDE.md')) ? path.join(project, 'CLAUDE.md') : null,
    skills: {
      global: listSkillDirs(path.join(claudeDir, 'skills')),
      project: listSkillDirs(path.join(projClaudeDir, 'skills')),
    },
    mcpServers,
    hookConfigs,
    agents: {
      global: listAgentFiles(path.join(claudeDir, 'agents')),
      project: listAgentFiles(path.join(projClaudeDir, 'agents')),
    },
    permissionRules: permissionRuleCount(globalSettings) + permissionRuleCount(projSettings) + permissionRuleCount(projLocalSettings),
    permissions: mergedPermissions([globalSettings, projSettings, projLocalSettings]),
    sessionCount,
  };
}
