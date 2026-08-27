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
export const PERMS_PKGS = ['dsh-movein-permissions'];

// npm dist-tags for satellite packages lag the core (hooks latest was rc.5
// while dsh was rc.6), so installs are pinned to the host dsh version.
export function hostDshVersion(dshHome) {
  const candidates = [path.join(dshHome, 'profiles', 'node_modules', '@deepseek-ai', 'dsh', 'package.json')];
  const running = runningDshBin(process.argv[1]);
  if (running) candidates.unshift(path.resolve(path.dirname(running), '..', 'package.json'));
  for (const file of candidates) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')).version || null; } catch { /* try the next location */ }
  }
  return null;
}

// A patch row whose package the profile cannot resolve makes `dsh web` boot
// fatally (plugin tree failed to load), so rows are only written for packages
// that resolve, installing them via `dsh plugin add` first when needed.
export function packageResolvable(dshHome, profile, pkg) {
  for (const base of [path.join(dshHome, 'profiles', profile), path.join(dshHome, 'profiles')]) {
    try {
      const resolved = createRequire(path.join(base, 'x.js')).resolve(pkg + '/package.json');
      // Node caches successful resolution. Confirm the target still exists so
      // doctor cannot report a package as wired after it was removed.
      if (exists(resolved)) return true;
    } catch { /* keep looking */ }
  }
  return false;
}

function runningDshBin(entry) {
  if (typeof entry !== 'string' || !entry) return null;
  try {
    const real = fs.realpathSync(entry);
    return /[\\/]node_modules[\\/]@deepseek-ai[\\/]dsh[\\/]lib[\\/]bin\.js$/i.test(real) ? real : null;
  } catch { return null; }
}

function dshPluginCommand(profile, specs, entry = process.argv[1]) {
  const current = runningDshBin(entry);
  if (current) {
    return { file: process.execPath, args: [current, 'plugin', '--profile', profile, 'add', ...specs], shell: false };
  }
  return {
    file: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    args: ['-y', '@deepseek-ai/dsh', 'plugin', '--profile', profile, 'add', ...specs],
    shell: process.platform === 'win32',
  };
}

export function installerCommand(profile, pkg, version, entry = process.argv[1]) {
  const spec = version ? `${pkg}@${version}` : pkg;
  return dshPluginCommand(profile, [spec], entry);
}

function runInstallerCommand(command) {
  const result = spawnSync(command.file, command.args, {
    stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 180000, shell: command.shell,
  });
  return result.status === 0;
}

export function defaultInstaller(profile, pkg, version) {
  return runInstallerCommand(installerCommand(profile, pkg, version));
}

function defaultInstallerBatch(profile, specs) {
  return runInstallerCommand(dshPluginCommand(profile, specs));
}

const exists = (p) => {
  try { fs.lstatSync(p); return true; } catch { return false; }
};

const yq = (s) => `'${String(s).replaceAll("'", "''")}'`;

const yamlEnvValue = (v) => {
  const value = String(v);
  const exact = /^(?:\$\{|\{env:)([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(value);
  if (exact) return `!!js process.env.${exact[1]}`;
  if (!/\{env:[A-Za-z_][A-Za-z0-9_]*\}/.test(value)) return yq(value);
  const template = value
    .replaceAll('\\', '\\\\')
    .replaceAll('`', '\\`')
    .replaceAll('${', '\\${')
    .replace(/\{env:([A-Za-z_][A-Za-z0-9_]*)\}/g, '${process.env.$1}');
  return `!!js ${yq(`\`${template}\``)}`;
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
    lines.push(`        command: ${yamlEnvValue(cfg.command)}`);
    if (cfg.args?.length) lines.push(`        args: [${cfg.args.map(yamlEnvValue).join(', ')}]`);
  } else {
    lines.push(`        transport: streamable-http`);
    lines.push(`        url: ${yamlEnvValue(cfg.url)}`);
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

// CC tools with a DSH-side equivalent the gate can match (see plugin/index.js).
const MAPPABLE_CC_TOOLS = new Set(['Bash', 'Read', 'Write', 'Edit']);

// Split deny/ask rules into enforced (shipped to the gate) and unmapped
// (no DSH-side tool to match, listed in the migration diff report instead
// of being silently dropped).
export function classifyPermissions(permissions) {
  const out = { deny: [], ask: [], unmapped: [] };
  for (const k of ['deny', 'ask']) {
    for (const r of permissions[k]) {
      const tool = String(r).trim().split('(')[0];
      if (MAPPABLE_CC_TOOLS.has(tool) || tool.startsWith('mcp__')) out[k].push(r);
      else out.unmapped.push(`${r} (${k})`);
    }
  }
  return out;
}

function permsRow(permissions) {
  const enforced = classifyPermissions(permissions);
  if (!enforced.deny.length && !enforced.ask.length) return null;
  const lines = [
    `    - id: cc-permissions`,
    `      name: 'dsh-movein-permissions'`,
    `      config:`,
  ];
  for (const k of ['deny', 'ask']) {
    if (!enforced[k].length) continue;
    lines.push(`        ${k}:`);
    for (const r of enforced[k]) lines.push(`          - ${yq(r)}`);
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

export function buildPatchBlock(scanResult, { withMcp = true, withHooks = true, withPerms = true } = {}) {
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
  if (withPerms) {
    const row = permsRow(scanResult.permissions);
    if (row) rows.push(row);
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

const kebab = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Convert a Claude Code subagent markdown (frontmatter + system prompt body)
// into a DSH skill. ponytail: single-line frontmatter scalars only - multiline
// description blocks fall back to a generic description.
export function agentToSkill(mdText, fallbackName, origin = 'Claude Code subagent') {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(mdText);
  if (!m) return null;
  const get = (k) => {
    const r = new RegExp('^' + k + ':[ \\t]*(.+)$', 'm').exec(m[1]);
    return r ? r[1].trim().replace(/^['"]|['"]$/g, '') : '';
  };
  const name = kebab(get('name') || fallbackName);
  if (!name) return null;
  const description = get('description') || `Converted from the ${origin} ${name}`;
  const skillMd = [
    '---',
    `name: ${name}`,
    `description: ${yq(description)}`,
    `whenToUse: ${yq(`Adopt the ${name} persona from the ${origin}. ${description}`)}`,
    '---',
    '',
    m[2].trim(),
    '',
  ].join('\n');
  return { name, skillMd };
}

// Convert a Claude Code slash command (.claude/commands/*.md) into a
// user-invocable DSH skill. Users keep typing /name; the command body rides
// along as the skill instructions.
export function commandToSkill(mdText, fallbackName, origin = 'Claude Code slash command') {
  const name = kebab(fallbackName);
  if (!name) return null;
  let fm = '', body = mdText;
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(mdText);
  if (m) { fm = m[1]; body = m[2]; }
  const get = (k) => {
    const r = new RegExp('^' + k + ':[ \\t]*(.+)$', 'm').exec(fm);
    return r ? r[1].trim().replace(/^['"]|['"]$/g, '') : '';
  };
  const description = get('description')
    || body.trim().split('\n')[0].slice(0, 100)
    || `Converted from the ${origin} /${name}`;
  const hint = get('argument-hint');
  const skillMd = [
    '---',
    `name: ${name}`,
    `description: ${yq(description)}`,
    '---',
    '',
    `Converted from a ${origin}. The user invokes this as /${name}${hint ? ` (arguments: ${hint})` : ''}; treat any text the user provides with it as $ARGUMENTS.`,
    '',
    body.trim(),
    '',
  ].join('\n');
  return { name, skillMd };
}

// Existing patch file is copied aside before every --apply overwrite;
// `dsh-movein restore` puts the newest copy back.
export function backupPatch(dshHome) {
  const patch = path.join(dshHome, 'cordis.patch.yml');
  if (!exists(patch)) return null;
  const dir = path.join(dshHome, 'movein-backups');
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `cordis.patch.yml.${new Date().toISOString().replace(/[:.]/g, '-')}`);
  fs.copyFileSync(patch, dest);
  return dest;
}

export function restoreLatestBackup(dshHome) {
  const dir = path.join(dshHome, 'movein-backups');
  if (!exists(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.startsWith('cordis.patch.yml.')).sort();
  if (!files.length) return null;
  const src = path.join(dir, files.at(-1));
  fs.copyFileSync(src, path.join(dshHome, 'cordis.patch.yml'));
  return src;
}

// Starting-point export in the dsh-permission-rules YAML shape, so users who
// want that engine's richer matching can begin from their Claude Code rules.
export function emitRules(permissions) {
  const L = ['# generated by dsh-movein --emit-rules from Claude Code settings',
    '# REVIEW BEFORE USE, param/path mapping is approximate. Engine: PerryLink/dsh-permission-rules',
    'rules:'];
  const row = (r, action) => {
    const m = /^([A-Za-z_][\w]*(?:__[\w-]+)*)(?:\((.*)\))?$/.exec(r.trim());
    if (!m) return;
    const [, tool, spec] = m;
    const glob = spec ? spec.replace(/:\*$/, '*') : null;
    if (tool === 'Bash') {
      L.push(`  - match: { tools: [bash, pwsh]${glob ? `, params: { command: ${JSON.stringify(glob)} }` : ''} }`);
    } else if (tool === 'Read' || tool === 'Write' || tool === 'Edit') {
      L.push(`  - match: { tools: [${tool.toLowerCase()}]${glob ? `, paths: [${JSON.stringify(glob)}]` : ''} }`);
    } else if (tool.startsWith('mcp__')) {
      L.push(`  - match: { tools: [${tool}] }`);
    } else {
      L.push(`  # no DSH equivalent for ${r} (${action}), skipped`);
      return;
    }
    L.push(`    action: ${action}`);
    L.push(`    reason: ${JSON.stringify(`migrated from Claude Code ${action} rule: ${r}`)}`);
  };
  for (const r of permissions.deny) row(r, 'deny');
  for (const r of permissions.ask) row(r, 'ask');
  return L.join('\n') + '\n';
}

export function planActions(scanResult, { copy = false } = {}) {
  const a = [];
  const { dshHome, project } = scanResult;

  for (const error of scanResult.errors ?? []) {
    a.push({
      label: path.basename(error.file || 'OpenCode config'),
      status: 'error',
      note: `${error.file || 'OpenCode config'} ${error.message}`,
      preflight: true,
    });
  }

  if (scanResult.projectClaudeMd) {
    a.push({ label: scanResult.projectInstructionLabel || 'CLAUDE.md (project)', status: 'native', note: 'DSH reads it natively, nothing to do' });
  }
  if (scanResult.globalClaudeMd) {
    const target = path.join(dshHome, 'AGENTS.md');
    const label = scanResult.globalInstructionLabel || 'CLAUDE.md (global)';
    if (scanResult.dshGlobalAgentsMd) {
      a.push({ label, status: 'skip', note: `${target} already exists, merge by hand if wanted` });
    } else {
      a.push({
        label, status: 'move', note: `link ${target} -> ${scanResult.globalClaudeMd}`,
        exec: () => { fs.mkdirSync(dshHome, { recursive: true }); fs.symlinkSync(scanResult.globalClaudeMd, target); },
        fallback: () => { fs.mkdirSync(dshHome, { recursive: true }); fs.copyFileSync(scanResult.globalClaudeMd, target); },
        fallbackNote: `copy ${target} from ${scanResult.globalClaudeMd} (symlink unavailable)`,
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
        kind: 'skill', src: s.dir, dest,
        exec: () => {
          fs.mkdirSync(s.destRoot, { recursive: true });
          if (copy) fs.cpSync(s.dir, dest, { recursive: true });
          else fs.symlinkSync(s.dir, dest);
        },
        ...(copy ? {} : {
          fallback: () => { fs.mkdirSync(s.destRoot, { recursive: true }); fs.cpSync(s.dir, dest, { recursive: true }); },
          fallbackNote: `copy -> ${dest} (symlink unavailable)`,
        }),
      });
    }
  }

  const agentMoves = [
    ...scanResult.agents.global.map((f) => ({ file: f, destRoot: path.join(dshHome, 'skills') })),
    ...scanResult.agents.project.map((f) => ({ file: f, destRoot: path.join(project, '.dsh', 'skills') })),
  ];
  for (const g of agentMoves) {
    const base = path.basename(g.file, '.md');
    let conv = null;
    try { conv = agentToSkill(fs.readFileSync(g.file, 'utf8'), base, scanResult.agentOrigin); } catch { /* unreadable */ }
    if (!conv) {
      a.push({ label: `agent ${base}`, status: 'skip', note: 'no frontmatter, not converted' });
      continue;
    }
    const dest = path.join(g.destRoot, conv.name);
    if (exists(dest)) {
      a.push({ label: `agent ${base}`, status: 'skip', note: `${dest} already exists` });
    } else {
      a.push({
        label: `agent ${base}`, status: 'move', note: `convert to skill -> ${dest}/SKILL.md`,
        kind: 'agent', src: g.file, dest,
        exec: () => { fs.mkdirSync(dest, { recursive: true }); fs.writeFileSync(path.join(dest, 'SKILL.md'), conv.skillMd); },
      });
    }
  }

  for (const item of scanResult.inlineAgents ?? []) {
    const destRoot = item.scope === 'project' ? path.join(project, '.dsh', 'skills') : path.join(dshHome, 'skills');
    const source = [
      '---',
      `name: ${item.name}`,
      ...(item.cfg.description ? [`description: ${yq(item.cfg.description)}`] : []),
      '---',
      '',
      String(item.cfg.system ?? item.cfg.prompt ?? ''),
    ].join('\n');
    const conv = agentToSkill(source, item.name, scanResult.agentOrigin);
    const dest = path.join(destRoot, conv.name);
    if (exists(dest)) {
      a.push({ label: `agent ${item.name}`, status: 'skip', note: `${dest} already exists` });
    } else {
      a.push({
        label: `agent ${item.name}`, status: 'move', note: `convert to skill -> ${dest}/SKILL.md`,
        kind: 'agent', src: `${item.sourcePath}#agent.${item.name}`, dest,
        exec: () => { fs.mkdirSync(dest, { recursive: true }); fs.writeFileSync(path.join(dest, 'SKILL.md'), conv.skillMd); },
      });
    }
  }

  const commandMoves = [
    ...scanResult.commands.global.map((f) => ({ file: f, destRoot: path.join(dshHome, 'skills') })),
    ...scanResult.commands.project.map((f) => ({ file: f, destRoot: path.join(project, '.dsh', 'skills') })),
  ];
  const cmdWord = scanResult.commandLabel || 'command';
  for (const c of commandMoves) {
    const base = path.basename(c.file, '.md');
    let conv = null;
    try { conv = commandToSkill(fs.readFileSync(c.file, 'utf8'), base, scanResult.commandOrigin); } catch { /* unreadable */ }
    if (!conv) {
      a.push({ label: `${cmdWord} /${base}`, status: 'skip', note: 'unreadable, not converted' });
      continue;
    }
    const dest = path.join(c.destRoot, conv.name);
    if (exists(dest)) {
      a.push({ label: `${cmdWord} /${base}`, status: 'skip', note: `${dest} already exists` });
    } else {
      a.push({
        label: `${cmdWord} /${base}`, status: 'move', note: `convert to user-invocable skill -> ${dest}/SKILL.md`,
        kind: 'command', src: c.file, dest,
        exec: () => { fs.mkdirSync(dest, { recursive: true }); fs.writeFileSync(path.join(dest, 'SKILL.md'), conv.skillMd); },
      });
    }
  }


  for (const item of scanResult.inlineCommands ?? []) {
    const destRoot = item.scope === 'project' ? path.join(project, '.dsh', 'skills') : path.join(dshHome, 'skills');
    const source = [
      '---',
      ...(item.cfg.description ? [`description: ${yq(item.cfg.description)}`] : []),
      '---',
      '',
      String(item.cfg.template ?? item.cfg.prompt ?? ''),
    ].join('\n');
    const conv = commandToSkill(source, item.name, scanResult.commandOrigin);
    const dest = path.join(destRoot, conv.name);
    if (exists(dest)) {
      a.push({ label: `${cmdWord} /${item.name}`, status: 'skip', note: `${dest} already exists` });
    } else {
      a.push({
        label: `${cmdWord} /${item.name}`, status: 'move', note: `convert to user-invocable skill -> ${dest}/SKILL.md`,
        kind: 'command', src: `${item.sourcePath}#command.${item.name}`, dest,
        exec: () => { fs.mkdirSync(dest, { recursive: true }); fs.writeFileSync(path.join(dest, 'SKILL.md'), conv.skillMd); },
      });
    }
  }

  if (buildPatchBlock(scanResult)) {
    const patchPath = path.join(dshHome, 'cordis.patch.yml');
    const profile = scanResult.profile || 'web';
    const profileDir = path.join(dshHome, 'profiles', profile);
    a.push({
      label: 'MCP + hooks + permissions', status: 'move', note: `write generated block into ${patchPath}`,
      exec: (installer = defaultInstaller) => {
        if (!exists(profileDir)) {
          throw new Error(`profile ${profileDir} not found, run dsh web once first, then re-run --apply`);
        }
        const wants = {
          withMcp: buildPatchBlock(scanResult, { withHooks: false, withPerms: false }) !== null,
          withHooks: buildPatchBlock(scanResult, { withMcp: false, withPerms: false }) !== null,
          withPerms: buildPatchBlock(scanResult, { withMcp: false, withHooks: false }) !== null,
        };
        const pin = hostDshVersion(dshHome);
        const dropped = [];
        const groups = [['withMcp', MCP_PKGS], ['withHooks', HOOKS_PKGS], ['withPerms', PERMS_PKGS]];
        if (installer === defaultInstaller) {
          const missing = groups.flatMap(([key, pkgs]) => wants[key]
            ? pkgs.filter((pkg) => !packageResolvable(dshHome, profile, pkg)).map((pkg) => ({ key, pkg }))
            : []);
          const specs = missing.map(({ pkg }) => pkg.startsWith('@deepseek-ai/') && pin ? `${pkg}@${pin}` : pkg);
          const installed = specs.length === 0 || defaultInstallerBatch(profile, specs);
          for (const { key, pkg } of missing) {
            if (installed && packageResolvable(dshHome, profile, pkg)) continue;
            wants[key] = false;
            if (!dropped.includes(pkg)) dropped.push(pkg);
          }
        } else {
          for (const [key, pkgs] of groups) {
            if (!wants[key]) continue;
            for (const pkg of pkgs) {
              if (packageResolvable(dshHome, profile, pkg)) continue;
              const v = pkg.startsWith('@deepseek-ai/') ? pin : null;
              if (installer(profile, pkg, v) && packageResolvable(dshHome, profile, pkg)) continue;
              wants[key] = false;
              dropped.push(pkg);
              break;
            }
          }
        }
        const block = buildPatchBlock(scanResult, wants);
        if (block) { backupPatch(dshHome); writePatchFile(patchPath, block); }
        if (dropped.length) {
          throw new Error(`could not install ${dropped.join(', ')}, matching rows skipped. Install by hand: npx @deepseek-ai/dsh plugin --profile ${profile} add ${dropped.join(' ')}, then re-run --apply`);
        }
      },
    });
  }
  return a;
}

export function applyActions(actions, { installer, scanResult } = {}) {
  if (actions.some((act) => act.preflight && act.status === 'error')) return actions;
  for (const act of actions) {
    if (act.status !== 'move') continue;
    try {
      act.exec(installer);
      act.status = 'done';
    } catch (e) {
      if ((e.code === 'EPERM' || e.code === 'EACCES') && act.fallback) {
        try {
          act.fallback();
          act.status = 'done';
          act.note = act.fallbackNote;
          continue;
        } catch (fallbackError) {
          e = fallbackError;
        }
      }
      act.status = 'error';
      act.note = String(e.message || e);
    }
  }
  if (scanResult) writeManifest(scanResult, actions);
  return actions;
}

// Where each skill/agent came from - so "why is this skill stale/odd" is
// answerable later. Appended per apply run at $DSH_HOME/movein-manifest.json.
export function writeManifest(scanResult, actions) {
  const moved = actions.filter((a) => a.kind && a.status === 'done')
    .map((a) => ({ kind: a.kind, label: a.label, source: a.src, dest: a.dest }));
  if (!moved.length) return;
  const file = path.join(scanResult.dshHome, 'movein-manifest.json');
  let runs = [];
  try { runs = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* fresh */ }
  runs.push({ at: new Date().toISOString(), project: scanResult.project, moved });
  fs.writeFileSync(file, JSON.stringify(runs, null, 2) + '\n');
}
