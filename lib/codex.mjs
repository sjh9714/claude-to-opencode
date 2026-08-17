// Codex CLI origin: scan ~/.codex the way scan.mjs scans ~/.claude, and
// return the same shape so planActions/renderReport work unchanged.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const exists = (p) => { try { fs.lstatSync(p); return true; } catch { return false; } };

// ponytail: naive TOML subset, table headers + strings + string arrays +
// inline string tables. Enough for [mcp_servers.*] in codex config.toml;
// multiline strings and dates are out of scope, swap in a real parser if a
// config ever needs them.
export function parseCodexMcpServers(toml) {
  const servers = {};
  let cur = null;
  let section = null; // 'root' | 'env' | null
  for (const raw of toml.split(/\r?\n/)) {
    const line = raw.replace(/\s#[^"']*$/, '').trim();
    if (!line || line.startsWith('#')) continue;
    const tbl = /^\[([^\]]+)\]$/.exec(line);
    if (tbl) {
      const parts = tbl[1].split('.').map((s) => s.trim().replace(/^["']|["']$/g, ''));
      if (parts[0] === 'mcp_servers' && parts.length >= 2) {
        cur = parts[1];
        servers[cur] ??= {};
        if (parts.length === 2) section = 'root';
        else if (parts.length === 3 && parts[2] === 'env') { section = 'env'; servers[cur].env ??= {}; }
        else section = null;
      } else { cur = null; section = null; }
      continue;
    }
    if (!cur || !section) continue;
    const kv = /^([A-Za-z0-9_-]+|"[^"]+")\s*=\s*(.+)$/.exec(line);
    if (!kv) continue;
    const key = kv[1].replace(/^"|"$/g, '');
    const val = parseValue(kv[2].trim());
    if (val === undefined) continue;
    if (section === 'env') servers[cur].env[key] = val;
    else if (key === 'env' && val && typeof val === 'object' && !Array.isArray(val)) servers[cur].env = val;
    else servers[cur][key] = val;
  }
  return servers;
}

function parseValue(s) {
  if (s.startsWith('"')) {
    const m = /^"((?:[^"\\]|\\.)*)"/.exec(s);
    return m ? m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\') : undefined;
  }
  if (s.startsWith("'")) {
    const m = /^'([^']*)'/.exec(s);
    return m ? m[1] : undefined;
  }
  if (s.startsWith('[')) {
    const out = [];
    for (const m of s.matchAll(/"((?:[^"\\]|\\.)*)"|'([^']*)'/g)) out.push((m[1] ?? m[2]).replace(/\\"/g, '"'));
    return out;
  }
  if (s.startsWith('{')) {
    const out = {};
    for (const m of s.matchAll(/([A-Za-z0-9_-]+|"[^"]+")\s*=\s*(?:"((?:[^"\\]|\\.)*)"|'([^']*)')/g)) {
      out[m[1].replace(/^"|"$/g, '')] = (m[2] ?? m[3] ?? '').replace(/\\"/g, '"');
    }
    return out;
  }
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+$/.test(s)) return Number(s);
  return undefined;
}

const countJsonl = (dir, depth = 3) => {
  if (!exists(dir) || depth < 0) return 0;
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) n += countJsonl(path.join(dir, e.name), depth - 1);
    else if (e.name.endsWith('.jsonl')) n++;
  }
  return n;
};

export function scanCodex({ home = os.homedir(), project = process.cwd(), dshHome, profile } = {}) {
  dshHome = dshHome || process.env.DSH_HOME || path.join(home, '.dsh');
  const codexDir = path.join(home, '.codex');
  const cfgPath = path.join(codexDir, 'config.toml');

  let mcpServers = [];
  try {
    mcpServers = Object.entries(parseCodexMcpServers(fs.readFileSync(cfgPath, 'utf8')))
      .filter(([, cfg]) => typeof cfg.command === 'string')
      .map(([name, cfg]) => ({
        name,
        cfg: { command: cfg.command, args: cfg.args ?? [], ...(cfg.env ? { env: cfg.env } : {}) },
        scope: 'codex', sourcePath: cfgPath,
      }));
  } catch { /* no config.toml */ }

  const agentsMd = path.join(codexDir, 'AGENTS.md');
  const promptsDir = path.join(codexDir, 'prompts');
  const prompts = exists(promptsDir)
    ? fs.readdirSync(promptsDir).filter((f) => f.endsWith('.md')).map((f) => path.join(promptsDir, f))
    : [];

  return {
    origin: 'Codex',
    commandLabel: 'prompt',
    commandOrigin: 'Codex custom prompt',
    globalInstructionLabel: 'AGENTS.md (global)',
    dshHome, project, profile: profile || 'web',
    codexDir,
    globalClaudeMd: exists(agentsMd) ? agentsMd : null,
    dshGlobalAgentsMd: exists(path.join(dshHome, 'AGENTS.md')),
    projectClaudeMd: null,
    skills: { global: [], project: [] },
    agents: { global: [], project: [] },
    commands: { global: prompts, project: [] },
    mcpServers,
    hookConfigs: [],
    permissions: { deny: [], ask: [] },
    permissionRules: 0,
    sessionCount: countJsonl(path.join(codexDir, 'sessions')),
  };
}
