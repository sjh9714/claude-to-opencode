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

const hookCommands = (settings) => {
  const out = [];
  for (const groups of Object.values(settings?.hooks ?? {})) {
    for (const g of groups ?? []) for (const h of g?.hooks ?? []) {
      if (typeof h?.command === 'string') out.push(h.command);
    }
  }
  return out;
};

// Env vars the DSH hooks bridge substitutes, plus universal shell vars.
const KNOWN_HOOK_VARS = new Set([
  'CLAUDE_PROJECT_DIR', 'CLAUDE_PLUGIN_ROOT',
  'HOME', 'PATH', 'USER', 'PWD', 'SHELL', 'TMPDIR', 'LOGNAME', 'LANG',
]);

export function unknownHookEnvVars(hookConfigs) {
  const found = new Map();
  for (const hc of hookConfigs) {
    for (const cmd of hc.commands) {
      for (const m of cmd.matchAll(/\$\{?([A-Z_][A-Z0-9_]*)\}?/g)) {
        if (!KNOWN_HOOK_VARS.has(m[1]) && !found.has(m[1])) found.set(m[1], hc.scope);
      }
    }
  }
  return [...found].map(([name, scope]) => ({ name, scope }));
}

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

// DSH parses SKILL.md frontmatter with a strict YAML parser; an unquoted
// description containing ": " throws and the skill silently vanishes from the
// catalog (upstream discussion #1401). Detect that shape before it bites.
export function riskyFrontmatter(skillDir) {
  try {
    const raw = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
    if (!m) return 'no frontmatter, DSH will not list it';
    const d = /^description:[ \t]*(.*)$/m.exec(m[1]);
    if (!d) return null;
    const v = d[1].trim();
    if (v === '' || v.startsWith("'") || v.startsWith('"') || v.startsWith('>') || v.startsWith('|')) return null;
    if (v.includes(': ')) return 'unquoted ": " in description, DSH drops the whole skill silently (#1401)';
    return null;
  } catch { return null; }
}

const SECRET_RE = /(sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})/;

// Plaintext secret-looking values that --apply would copy into ~/.dsh config.
export function secretFindings(scanResult) {
  const out = [];
  for (const s of scanResult.mcpServers) {
    for (const [k, v] of Object.entries(s.cfg.env ?? {})) {
      if (typeof v === 'string' && !/^\$\{/.test(v) && SECRET_RE.test(v)) out.push(`MCP ${s.name} env ${k}`);
    }
  }
  for (const hc of scanResult.hookConfigs) {
    for (const cmd of hc.commands) if (SECRET_RE.test(cmd)) out.push(`${hc.scope} hook command`);
  }
  return out;
}

const listCommandFiles = (dir) => {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => path.join(dir, f));
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
  ].map((h) => ({ ...h, events: hookEventCount(h.settings), commands: hookCommands(h.settings) }))
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
    commands: {
      global: listCommandFiles(path.join(claudeDir, 'commands')),
      project: listCommandFiles(path.join(projClaudeDir, 'commands')),
    },
    permissionRules: permissionRuleCount(globalSettings) + permissionRuleCount(projSettings) + permissionRuleCount(projLocalSettings),
    permissions: mergedPermissions([globalSettings, projSettings, projLocalSettings]),
    sessionCount,
  };
}
