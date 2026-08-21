import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse, printParseErrorCode } from 'jsonc-parser';

const exists = (p) => {
  try { fs.lstatSync(p); return true; } catch { return false; }
};

const asArray = (value) => value == null ? [] : Array.isArray(value) ? value : [value];
const isUrl = (value) => /^https?:\/\//i.test(String(value));
const hasGlob = (value) => /[*?\[\]{}]/.test(String(value));
const stringRecord = (value) => value === undefined
  || (value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every((item) => typeof item === 'string'));

function readConfig(file, scope, errors) {
  if (!file || !exists(file)) return null;
  try {
    const failures = [];
    const data = parse(fs.readFileSync(file, 'utf8'), failures, {
      allowTrailingComma: true,
      disallowComments: false,
    });
    if (failures.length) {
      const first = failures[0];
      errors.push({
        file,
        message: `${printParseErrorCode(first.error)} at offset ${first.offset}`,
      });
      return null;
    }
    return { file, scope, data: data && typeof data === 'object' ? data : {} };
  } catch (error) {
    errors.push({ file, message: String(error.message || error) });
    return null;
  }
}

function configFiles(root, scope) {
  if (!root) return [];
  return [
    { file: path.join(root, 'opencode.json'), scope },
    { file: path.join(root, 'opencode.jsonc'), scope },
  ];
}

function projectDirs(project) {
  const start = path.resolve(project);
  const dirs = [start];
  let current = start;
  while (!exists(path.join(current, '.git'))) {
    const parent = path.dirname(current);
    if (parent === current) return [start];
    current = parent;
    dirs.push(current);
  }
  return dirs.reverse();
}

function listSkillDirs(root) {
  if (!exists(root)) return [];
  if (exists(path.join(root, 'SKILL.md'))) return [{ name: path.basename(root), dir: root }];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => (entry.isDirectory() || entry.isSymbolicLink()) && exists(path.join(root, entry.name, 'SKILL.md')))
    .map((entry) => ({ name: entry.name, dir: path.join(root, entry.name) }));
}

function listMarkdown(dir) {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => path.join(dir, file));
}

function putNamed(map, name, value) {
  if (typeof name === 'string' && name) map.set(name, value);
}

function collectDirectoryAssets(roots) {
  const skills = new Map();
  const agents = new Map();
  const commands = new Map();
  for (const { root, scope } of roots) {
    if (!root) continue;
    for (const dirName of ['skill', 'skills']) {
      for (const item of listSkillDirs(path.join(root, dirName))) putNamed(skills, item.name, { ...item, scope });
    }
    for (const dirName of ['agent', 'agents']) {
      for (const file of listMarkdown(path.join(root, dirName))) putNamed(agents, path.basename(file, '.md'), { file, scope });
    }
    for (const dirName of ['command', 'commands']) {
      for (const file of listMarkdown(path.join(root, dirName))) putNamed(commands, path.basename(file, '.md'), { file, scope });
    }
  }
  return { skills, agents, commands };
}

function configuredSkillSources(config) {
  const block = config.data.skills ?? config.data.skill;
  if (block == null) return { paths: [], urls: [] };
  if (Array.isArray(block) || typeof block === 'string') {
    const values = asArray(block);
    return {
      paths: values.filter((value) => typeof value === 'string' && !isUrl(value)),
      urls: values.filter((value) => typeof value === 'string' && isUrl(value)),
    };
  }
  if (typeof block !== 'object') return { paths: [], urls: [] };
  return {
    paths: [...asArray(block.path), ...asArray(block.paths)].filter((value) => typeof value === 'string'),
    urls: [...asArray(block.url), ...asArray(block.urls)].filter((value) => typeof value === 'string'),
  };
}

function mergeInline(configs, singular, plural) {
  const out = new Map();
  for (const config of configs) {
    for (const block of [config.data[singular], config.data[plural]]) {
      if (!block || typeof block !== 'object' || Array.isArray(block)) continue;
      for (const [name, cfg] of Object.entries(block)) {
        if (cfg && typeof cfg === 'object') out.set(name, { name, cfg, scope: config.scope, sourcePath: config.file });
      }
    }
  }
  return [...out.values()];
}

function mergeMcp(configs, notices) {
  const merged = new Map();
  for (const config of configs) {
    const block = config.data.mcp;
    if (!block || typeof block !== 'object' || Array.isArray(block)) continue;
    for (const [name, raw] of Object.entries(block)) {
      if (name === 'servers' || name === 'timeout') continue;
      merged.set(name, { name, raw, scope: config.scope, sourcePath: config.file });
    }
    const servers = block.servers;
    if (servers !== undefined && (!servers || typeof servers !== 'object' || Array.isArray(servers))) {
      notices.push({ kind: 'mcp', sourcePath: config.file, message: 'malformed MCP servers block, skipped' });
      continue;
    }
    for (const [name, raw] of Object.entries(servers ?? {})) {
      merged.set(name, { name, raw, scope: config.scope, sourcePath: config.file });
    }
  }

  const out = [];
  for (const entry of merged.values()) {
    const { name, raw, scope, sourcePath } = entry;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      notices.push({ kind: 'mcp', sourcePath, message: `malformed MCP ${name}, skipped` });
      continue;
    }
    if (raw.enabled === false || raw.disabled === true) {
      notices.push({ kind: 'mcp', sourcePath, message: `disabled MCP ${name}, skipped` });
      continue;
    }
    if (raw.type === 'local') {
      if (!Array.isArray(raw.command) || !raw.command.length || raw.command.some((value) => typeof value !== 'string')
        || !raw.command[0] || !stringRecord(raw.environment) || (raw.cwd !== undefined && typeof raw.cwd !== 'string')) {
        notices.push({ kind: 'mcp', sourcePath, message: `malformed MCP ${name}, skipped` });
        continue;
      }
      out.push({
        name,
        cfg: {
          command: raw.command[0],
          args: raw.command.slice(1),
          ...(raw.environment && typeof raw.environment === 'object' ? { env: raw.environment } : {}),
          ...(typeof raw.cwd === 'string' ? { cwd: raw.cwd } : {}),
        },
        scope,
        sourcePath,
      });
      continue;
    }
    if (raw.type === 'remote') {
      if (typeof raw.url !== 'string' || !raw.url || !stringRecord(raw.headers)) {
        notices.push({ kind: 'mcp', sourcePath, message: `malformed MCP ${name}, skipped` });
        continue;
      }
      out.push({
        name,
        cfg: {
          type: 'streamable-http',
          url: raw.url,
          ...(raw.headers && typeof raw.headers === 'object' ? { headers: raw.headers } : {}),
        },
        scope,
        sourcePath,
      });
      continue;
    }
    notices.push({ kind: 'mcp', sourcePath, message: `malformed MCP ${name}, skipped` });
  }
  return out;
}

function instructionCandidate(configs, notices, globalRoot) {
  const sources = [];
  const agentsMd = path.join(globalRoot, 'AGENTS.md');
  if (exists(agentsMd)) sources.push({ file: agentsMd, scope: 'global', value: agentsMd, absolute: true });
  for (const config of configs) {
    for (const value of asArray(config.data.instructions)) {
      sources.push({ file: config.file, scope: config.scope, value });
    }
  }
  if (!sources.length) return null;
  if (sources.length === 1) {
    const source = sources[0];
    if (source.scope !== 'project' && typeof source.value === 'string' && !isUrl(source.value) && !hasGlob(source.value)) {
      const file = source.absolute ? source.value : path.resolve(path.dirname(source.file), source.value);
      if (exists(file)) return file;
    }
  }
  notices.push({
    kind: 'instructions',
    sourcePath: sources.map((source) => source.file).join(', '),
    message: 'OpenCode instructions need manual review because they are project scoped, multiple, missing, globbed, or remote',
  });
  return null;
}

export function scanOpenCode({
  home = os.homedir(),
  project = process.cwd(),
  dshHome,
  profile = 'web',
  env = process.env,
} = {}) {
  dshHome = dshHome || env.DSH_HOME || path.join(home, '.dsh');
  const globalRoot = path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'opencode');
  const customRoot = env.OPENCODE_CONFIG_DIR ? path.resolve(env.OPENCODE_CONFIG_DIR) : null;
  const projectRoots = projectDirs(project);
  const projectAgentsMd = [...projectRoots].reverse()
    .map((root) => path.join(root, 'AGENTS.md'))
    .find(exists) ?? null;
  const errors = [];
  const notices = [];

  const sources = [
    ...configFiles(globalRoot, 'global'),
    ...(env.OPENCODE_CONFIG ? [{ file: path.resolve(env.OPENCODE_CONFIG), scope: 'custom' }] : []),
    ...configFiles(customRoot, 'custom-dir'),
    ...projectRoots.flatMap((root) => configFiles(root, 'project')),
    ...projectRoots.flatMap((root) => configFiles(path.join(root, '.opencode'), 'project')),
  ];
  const configs = sources.map(({ file, scope }) => readConfig(file, scope, errors)).filter(Boolean);

  const assets = collectDirectoryAssets([
    { root: globalRoot, scope: 'global' },
    ...(customRoot ? [{ root: customRoot, scope: 'global' }] : []),
    ...projectRoots.map((root) => ({ root: path.join(root, '.opencode'), scope: 'project' })),
  ]);

  for (const config of configs) {
    const configured = configuredSkillSources(config);
    for (const value of configured.paths) {
      const root = path.resolve(path.dirname(config.file), value);
      for (const item of listSkillDirs(root)) {
        putNamed(assets.skills, item.name, { ...item, scope: config.scope === 'project' ? 'project' : 'global' });
      }
    }
    for (const value of configured.urls) {
      notices.push({ kind: 'skills', sourcePath: config.file, message: `URL skill source ${value}, skipped` });
    }
  }

  if (configs.some((config) => config.data.permission !== undefined || config.data.permissions !== undefined)) {
    notices.push({ kind: 'permissions', message: 'OpenCode permissions are unsupported and were not converted' });
  }
  if (configs.some((config) => config.data.plugin !== undefined || config.data.plugins !== undefined)) {
    notices.push({ kind: 'plugins', message: 'OpenCode plugins are unsupported and were not converted' });
  }
  notices.push({ kind: 'sessions', message: 'OpenCode sessions are out of scope' });

  const splitSkills = { global: [], project: [] };
  for (const item of assets.skills.values()) splitSkills[item.scope === 'project' ? 'project' : 'global'].push({ name: item.name, dir: item.dir });
  const splitFiles = (map) => {
    const out = { global: [], project: [] };
    for (const item of map.values()) out[item.scope === 'project' ? 'project' : 'global'].push(item.file);
    return out;
  };

  return {
    origin: 'OpenCode',
    agentOrigin: 'OpenCode agent',
    commandLabel: 'command',
    commandOrigin: 'OpenCode command',
    globalInstructionLabel: 'instruction (global)',
    projectInstructionLabel: 'AGENTS.md (project)',
    home,
    project,
    dshHome,
    profile,
    openCodeDir: globalRoot,
    configs,
    errors,
    notices,
    globalClaudeMd: instructionCandidate(configs, notices, globalRoot),
    dshGlobalAgentsMd: exists(path.join(dshHome, 'AGENTS.md')),
    projectClaudeMd: projectAgentsMd,
    skills: splitSkills,
    agents: splitFiles(assets.agents),
    commands: splitFiles(assets.commands),
    inlineAgents: mergeInline(configs, 'agent', 'agents'),
    inlineCommands: mergeInline(configs, 'command', 'commands'),
    mcpServers: mergeMcp(configs, notices),
    hookConfigs: [],
    permissions: { deny: [], ask: [] },
    permissionRules: 0,
    sessionCount: 0,
  };
}
