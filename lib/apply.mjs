import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const BLOCK_START = '# >>> dsh-movein (generated block, edits inside will be overwritten)';
const BLOCK_END = '# <<< dsh-movein';

// ponytail: known runtime deps hardcoded (hook-protocol is a peer the host
// install does not ship); revisit when DSH stabilizes its plugin contracts
export const HOOKS_PKGS = ['@deepseek-ai/dsh-hooks-claude-code', '@deepseek-ai/dsh-hook-protocol'];
export const MCP_PKGS = ['@deepseek-ai/dsh-mcp-client'];

// npm dist-tags for satellite packages lag the core (hooks latest was rc.5
// while dsh was rc.6), so installs are pinned to the host dsh version.
export function hostDshVersion(dshHome) {
  try {
    const p = path.join(dshHome, 'profiles', 'node_modules', '@deepseek-ai', 'dsh', 'package.json');
    return JSON.parse(fs.readFileSync(p, 'utf8')).version || null;
  } catch { return null; }
}

// A patch row whose package the profile cannot resolve makes `dsh web` boot
// fatally (plugin tree failed to load), so rows are only written for packages
// that resolve, installing them via `dsh plugin add` first when needed.
export function packageResolvable(dshHome, profile, pkg) {
  for (const base of [path.join(dshHome, 'profiles', profile), path.join(dshHome, 'profiles')]) {
    try {
      createRequire(path.join(base, 'x.js')).resolve(pkg + '/package.json');
      return true;
    } catch { /* keep looking */ }
  }
  return false;
}

export function defaultInstaller(profile, pkg, version) {
  const spec = version ? `${pkg}@${version}` : pkg;
  const r = spawnSync('npx', ['-y', '@deepseek-ai/dsh', 'plugin', '--profile', profile, 'add', spec], {
    stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 180000,
  });
  return r.status === 0;
}

const exists = (p) => {
  try { fs.lstatSync(p); return true; } catch { return false; }
};

const yq = (s) => `'${String(s).replaceAll("'", "''")}'`;

const yamlEnvValue = (v) => {
  const m = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(String(v));
  return m ? `!!js process.env.${m[1]}` : yq(v);
};

const idSafe = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';

function mcpRow(server) {
  const { name, cfg } = server;
  const lines = [
    `    - id: mcp-${idSafe(name)}`,
    `      name: '@deepseek-ai/dsh-mcp-client'`,
    `      config:`,
    `        serverName: ${yq(name)}`,
  ];
  const type = cfg.type || 'stdio';
  if (type === 'stdio') {
    lines.push(`        transport: stdio`);
    lines.push(`        command: ${yq(cfg.command)}`);
    if (cfg.args?.length) lines.push(`        args: [${cfg.args.map(yq).join(', ')}]`);
  } else {
    lines.push(`        transport: streamable-http`);
    lines.push(`        url: ${yq(cfg.url)}`);
    if (cfg.headers && Object.keys(cfg.headers).length) {
      lines.push(`        headers:`);
      for (const [k, v] of Object.entries(cfg.headers)) lines.push(`          ${yq(k)}: ${yamlEnvValue(v)}`);
    }
  }
  if (cfg.env && Object.keys(cfg.env).length) {
    lines.push(`        env:`);
    for (const [k, v] of Object.entries(cfg.env)) lines.push(`          ${k}: ${yamlEnvValue(v)}`);
  }
  return lines.join('\n');
}

function hooksRow(hookConfig, project) {
  return [
    `    - id: cc-hooks-${idSafe(hookConfig.scope)}`,
    `      name: '@deepseek-ai/dsh-hooks-claude-code'`,
    `      config:`,
    `        configPath: ${yq(hookConfig.file)}`,
    `        projectDir: ${yq(project)}`,
  ].join('\n');
}

export function buildPatchBlock(scanResult, { withMcp = true, withHooks = true } = {}) {
  const seen = new Set();
  const rows = [];
  if (withMcp) {
    for (const s of scanResult.mcpServers) {
      if (seen.has(s.name)) continue;
      seen.add(s.name);
      const type = s.cfg.type || 'stdio';
      if (type !== 'stdio' && type !== 'http' && type !== 'streamable-http') continue;
      rows.push(mcpRow(s));
    }
  }
  if (withHooks) {
    for (const h of scanResult.hookConfigs) rows.push(hooksRow(h, scanResult.project));
  }
  if (!rows.length) return null;
  return [BLOCK_START, '- insert:', rows.join('\n'), BLOCK_END, ''].join('\n');
}

export function writePatchFile(patchPath, block) {
  let head = '';
  if (exists(patchPath)) {
    const cur = fs.readFileSync(patchPath, 'utf8');
    const start = cur.indexOf(BLOCK_START);
    if (start >= 0) {
      const end = cur.indexOf(BLOCK_END);
      head = cur.slice(0, start) + cur.slice(end >= 0 ? end + BLOCK_END.length : cur.length);
    } else {
      head = cur;
    }
    head = head.replace(/\n{3,}/g, '\n\n');
    if (head && !head.endsWith('\n')) head += '\n';
  }
  fs.mkdirSync(path.dirname(patchPath), { recursive: true });
  fs.writeFileSync(patchPath, head + block);
}

export function planActions(scanResult, { copy = false } = {}) {
  const a = [];
  const { dshHome, project } = scanResult;

  if (scanResult.projectClaudeMd) {
    a.push({ label: 'CLAUDE.md (project)', status: 'native', note: 'DSH reads it natively, nothing to do' });
  }
  if (scanResult.globalClaudeMd) {
    const target = path.join(dshHome, 'AGENTS.md');
    if (scanResult.dshGlobalAgentsMd) {
      a.push({ label: 'CLAUDE.md (global)', status: 'skip', note: `${target} already exists, merge by hand if wanted` });
    } else {
      a.push({
        label: 'CLAUDE.md (global)', status: 'move', note: `link ${target} -> ${scanResult.globalClaudeMd}`,
        exec: () => { fs.mkdirSync(dshHome, { recursive: true }); fs.symlinkSync(scanResult.globalClaudeMd, target); },
      });
    }
  }

  const skillMoves = [
    ...scanResult.skills.global.map((s) => ({ ...s, destRoot: path.join(dshHome, 'skills') })),
    ...scanResult.skills.project.map((s) => ({ ...s, destRoot: path.join(project, '.dsh', 'skills') })),
  ];
  for (const s of skillMoves) {
    const dest = path.join(s.destRoot, s.name);
    if (exists(dest)) {
      a.push({ label: `skill ${s.name}`, status: 'skip', note: `${dest} already exists` });
    } else {
      a.push({
        label: `skill ${s.name}`, status: 'move', note: `${copy ? 'copy' : 'link'} -> ${dest}`,
        exec: () => {
          fs.mkdirSync(s.destRoot, { recursive: true });
          if (copy) fs.cpSync(s.dir, dest, { recursive: true });
          else fs.symlinkSync(s.dir, dest);
        },
      });
    }
  }

  if (buildPatchBlock(scanResult)) {
    const patchPath = path.join(dshHome, 'cordis.patch.yml');
    const profile = scanResult.profile || 'web';
    const profileDir = path.join(dshHome, 'profiles', profile);
    a.push({
      label: 'MCP servers + hooks', status: 'move', note: `write generated block into ${patchPath}`,
      exec: (installer = defaultInstaller) => {
        if (!exists(profileDir)) {
          throw new Error(`profile ${profileDir} not found, run dsh web once first, then re-run --apply`);
        }
        const wants = { withMcp: buildPatchBlock(scanResult, { withHooks: false }) !== null,
                        withHooks: buildPatchBlock(scanResult, { withMcp: false }) !== null };
        const pin = hostDshVersion(dshHome);
        const dropped = [];
        for (const [key, pkgs] of [['withMcp', MCP_PKGS], ['withHooks', HOOKS_PKGS]]) {
          if (!wants[key]) continue;
          for (const pkg of pkgs) {
            if (packageResolvable(dshHome, profile, pkg)) continue;
            if (installer(profile, pkg, pin) && packageResolvable(dshHome, profile, pkg)) continue;
            wants[key] = false;
            dropped.push(pkg);
            break;
          }
        }
        const block = buildPatchBlock(scanResult, wants);
        if (block) writePatchFile(patchPath, block);
        if (dropped.length) {
          throw new Error(`could not install ${dropped.join(', ')}, matching rows skipped. Install by hand: npx @deepseek-ai/dsh plugin --profile ${profile} add ${dropped.join(' ')}, then re-run --apply`);
        }
      },
    });
  }
  return a;
}

export function applyActions(actions, { installer } = {}) {
  for (const act of actions) {
    if (act.status !== 'move') continue;
    try { act.exec(installer); act.status = 'done'; } catch (e) { act.status = 'error'; act.note = String(e.message || e); }
  }
  return actions;
}
