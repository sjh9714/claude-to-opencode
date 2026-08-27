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
    for (const g of Array.isArray(groups) ? groups : []) {
      for (const h of Array.isArray(g?.hooks) ? g.hooks : []) {
        if (typeof h?.command === 'string') out.push(h.command);
      }
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

// The seven Claude Code hook events the dsh-hooks-claude-code bridge maps.
// A hook on any other event never fires under DSH, and the bridge only runs
// type "command" hooks. Rechecked against the 0.1.1-rc.2 package source.
export const BRIDGED_EVENTS = new Set([
  'SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse',
  'Stop', 'SubagentStart', 'SubagentStop',
]);

export function supportedCommandHookCount(hookConfigs = []) {
  let count = 0;
  for (const hc of hookConfigs) {
    for (const [event, groups] of Object.entries(hc.settings?.hooks ?? {})) {
      if (!BRIDGED_EVENTS.has(event) || !Array.isArray(groups)) continue;
      for (const group of groups) {
        if (!Array.isArray(group?.hooks)) continue;
        for (const hook of group.hooks) {
          if (hook?.type === 'command'
            && typeof hook?.command === 'string'
            && hook.command.trim()) count += 1;
        }
      }
    }
  }
  return count;
}

// Static inspection deliberately does not execute user hooks. These findings
// name current upstream enforcement gaps and tell the user what still needs a
// disposable runtime canary before a hook can be treated as a policy boundary.
export function hookSafetyFindings(hookConfigs = [], { platform = process.platform } = {}) {
  const supported = supportedCommandHookCount(hookConfigs);
  if (supported === 0) return [];
  const findings = [{
    kind: 'continue-false',
    message: 'DSH records but does not enforce hook {"continue":false} (#1514); do not use it as a policy stop',
  }];
  if (platform === 'win32') {
    findings.push({
      kind: 'windows-exit-code',
      message: 'Windows PowerShell may hide a native hook child\'s exit 2 (#2485/#3714); append `; exit $LASTEXITCODE` when appropriate and verify a harmless deny canary',
    });
  }
  findings.push({
    kind: 'canary',
    message: 'static inspection cannot prove hook enforcement; in a disposable project and new DSH session, confirm a lowercase-matcher PreToolUse exit-2 hook denies a harmless tool call',
  });
  return findings;
}

export function deadHooks(hookConfigs) {
  const out = [];
  for (const hc of hookConfigs) {
    for (const [event, groups] of Object.entries(hc.settings?.hooks ?? {})) {
      if (!BRIDGED_EVENTS.has(event)) {
        out.push({ scope: hc.scope, event, why: 'event is not among the 7 the DSH bridge maps, this hook never fires' });
        continue;
      }
      if (!Array.isArray(groups)) {
        out.push({ scope: hc.scope, event, why: 'event value is not an array, the bridge skips it' });
        continue;
      }
      for (const g of groups) {
        if (!Array.isArray(g?.hooks)) {
          out.push({ scope: hc.scope, event, why: 'matcher group has no hooks array, the bridge skips it' });
          continue;
        }
        for (const h of g.hooks) {
          if (h?.type !== 'command') {
            out.push({ scope: hc.scope, event, why: `type "${h?.type ?? 'missing'}" is skipped by the bridge, only command hooks run` });
          } else if (typeof h.command !== 'string' || !h.command.trim()) {
            out.push({ scope: hc.scope, event, why: 'command hook has no non-empty command, the bridge skips it' });
          }
        }
      }
    }
  }
  return out;
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

const listRuleFiles = (root) => {
  if (!exists(root)) return [];
  const files = [];
  const seen = new Set();
  const walk = (dir) => {
    let real;
    try { real = fs.realpathSync(dir); } catch { return; }
    if (seen.has(real)) return;
    seen.add(real);
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      let stat;
      try { stat = fs.statSync(file); } catch { continue; }
      if (stat.isDirectory()) walk(file);
      else if (stat.isFile() && file.endsWith('.md')) files.push(file);
    }
  };
  walk(root);
  return files.sort().map((file) => {
    let pathScoped = false;
    try {
      const text = fs.readFileSync(file, 'utf8');
      const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1];
      pathScoped = Boolean(frontmatter && /^paths[ \t]*:/m.test(frontmatter));
    } catch { /* unreadable files are surfaced when OpenCode loads them */ }
    return { file, pathScoped };
  });
};

const projectRoot = (start) => {
  let current = path.resolve(start);
  while (true) {
    const dotGit = path.join(current, '.git');
    if (exists(dotGit)) {
      try {
        if (fs.statSync(dotGit).isFile()) {
          const match = /^gitdir:\s*(.+)$/m.exec(fs.readFileSync(dotGit, 'utf8'));
          if (match) {
            const gitDir = path.resolve(current, match[1]);
            const marker = `${path.sep}.git${path.sep}worktrees${path.sep}`;
            const index = gitDir.lastIndexOf(marker);
            if (index !== -1) return gitDir.slice(0, index);
          }
        }
      } catch { /* fall back to the worktree root */ }
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(start);
    current = parent;
  }
};

const expandHome = (value, home) => value === '~'
  ? home
  : value.startsWith(`~${path.sep}`) || value.startsWith('~/')
    ? path.join(home, value.slice(2))
    : value;

function autoMemoryFile(home, project, settings) {
  if (settings?.autoMemoryEnabled === false) return null;
  const configured = settings?.autoMemoryDirectory;
  let dir;
  if (typeof configured === 'string' && configured.trim()) {
    const expanded = expandHome(configured.trim(), home);
    if (!path.isAbsolute(expanded)) return null;
    dir = expanded;
  } else {
    const key = projectRoot(project).replace(/[^A-Za-z0-9]/g, '-');
    dir = path.join(home, '.claude', 'projects', key, 'memory');
  }
  const file = path.join(dir, 'MEMORY.md');
  return exists(file) ? file : null;
}

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
    rules: {
      global: listRuleFiles(path.join(claudeDir, 'rules')),
      project: listRuleFiles(path.join(projClaudeDir, 'rules')),
    },
    autoMemoryFile: autoMemoryFile(home, project, globalSettings),
    permissionRules: permissionRuleCount(globalSettings) + permissionRuleCount(projSettings) + permissionRuleCount(projLocalSettings),
    permissions: mergedPermissions([globalSettings, projSettings, projLocalSettings]),
    sessionCount,
  };
}
