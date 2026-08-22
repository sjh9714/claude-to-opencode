import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyEdits, modify, parse, printParseErrorCode } from 'jsonc-parser';
import { inspectOpenCodeHookBridge, renderOpenCodeHookPlugin } from './opencode-hook-plugin.mjs';

const SECRET_RE = /(sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})/;

const exists = (file) => {
  try { fs.lstatSync(file); return true; } catch { return false; }
};

const yamlString = (value) => JSON.stringify(String(value));

function configPath(root) {
  for (const name of ['opencode.jsonc', 'opencode.json']) {
    const file = path.join(root, name);
    if (exists(file)) return file;
  }
  return path.join(root, 'opencode.json');
}

function inspectConfig(file) {
  if (!exists(file)) {
    return {
      data: {},
      text: '{\n  "$schema": "https://opencode.ai/config.json"\n}\n',
      v2: false,
    };
  }
  const text = fs.readFileSync(file, 'utf8');
  const failures = [];
  const data = parse(text, failures, { allowTrailingComma: true, disallowComments: false });
  if (failures.length) {
    const first = failures[0];
    return {
      error: `${printParseErrorCode(first.error)} at offset ${first.offset}`,
      text,
    };
  }
  return {
    data: data && typeof data === 'object' ? data : {},
    text,
    v2: Boolean(data?.mcp && typeof data.mcp === 'object' && !Array.isArray(data.mcp)
      && (Object.prototype.hasOwnProperty.call(data.mcp, 'servers')
        || (data.mcp.timeout && typeof data.mcp.timeout === 'object'))),
  };
}

function sourceFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) return { fields: {}, body: text };
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([A-Za-z][\w-]*):[ \t]*(.*)$/.exec(line);
    if (pair) fields[pair[1]] = pair[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return { fields, body: match[2] };
}

export function claudeAgentToOpenCode(text, fallbackName) {
  const { fields, body } = sourceFrontmatter(text);
  const description = fields.description || `Claude Code agent ${fallbackName}`;
  return {
    text: [
      '---',
      `description: ${yamlString(description)}`,
      'mode: subagent',
      '---',
      '',
      body.trim(),
      '',
    ].join('\n'),
    needsReview: Boolean(fields.tools || fields['allowed-tools'] || fields.permission || fields.permissions),
  };
}

function linkAction(label, src, dest, copy) {
  if (exists(dest)) return { label, status: 'skip', note: `${dest} already exists` };
  return {
    label,
    status: 'move',
    note: `${copy ? 'copy' : 'link'} -> ${dest}`,
    kind: 'instructions',
    src,
    dest,
    exec: () => {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      if (copy) fs.copyFileSync(src, dest);
      else fs.symlinkSync(src, dest);
    },
    ...(copy ? {} : {
      fallback: () => {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
      },
      fallbackNote: `copy -> ${dest} because a link was unavailable`,
    }),
  };
}

function fileAction(label, src, dest, transform = (value) => value) {
  if (exists(dest)) return { label, status: 'skip', note: `${dest} already exists` };
  return {
    label,
    status: 'move',
    note: `write -> ${dest}`,
    kind: label.startsWith('agent ') ? 'agent' : 'command',
    src,
    dest,
    exec: () => {
      const value = transform(fs.readFileSync(src, 'utf8'));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, value);
    },
  };
}

function generatedFileAction(label, src, dest, text, kind) {
  if (exists(dest)) return { label, status: 'skip', note: `${dest} already exists` };
  return {
    label,
    status: 'move',
    note: `write -> ${dest}`,
    kind,
    src,
    dest,
    exec: () => {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, text);
    },
  };
}

function mapEnvString(value) {
  return String(value).replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, '{env:$1}');
}

function mapStringRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return undefined;
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, mapEnvString(value)]));
}

export function claudeMcpToOpenCode(cfg, { v2 = false } = {}) {
  const type = cfg.type || 'stdio';
  if (type === 'http' || type === 'streamable-http' || type === 'remote') {
    return {
      type: 'remote',
      url: mapEnvString(cfg.url),
      ...(cfg.headers ? { headers: mapStringRecord(cfg.headers) } : {}),
      ...(v2 ? {} : { enabled: true }),
    };
  }
  return {
    type: 'local',
    command: [mapEnvString(cfg.command), ...(cfg.args ?? []).map(mapEnvString)],
    ...(cfg.cwd ? { cwd: mapEnvString(cfg.cwd) } : {}),
    ...(cfg.env ? { environment: mapStringRecord(cfg.env) } : {}),
    ...(v2 ? {} : { enabled: true }),
  };
}

function targetServers(data, v2) {
  const value = v2 ? data?.mcp?.servers : data?.mcp;
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function backupConfig(file) {
  if (!exists(file)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = `${file}.dsh-movein.${stamp}.bak`;
  fs.copyFileSync(file, backup);
  return backup;
}

function writeServers(file, inspection, servers) {
  let text = inspection.text;
  for (const { name, value } of servers) {
    const target = inspection.v2 ? ['mcp', 'servers', name] : ['mcp', name];
    const edits = modify(text, target, value, {
      formattingOptions: { insertSpaces: true, tabSize: 2, eol: '\n' },
    });
    text = applyEdits(text, edits);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const backup = backupConfig(file);
  fs.writeFileSync(file, text.endsWith('\n') ? text : `${text}\n`);
  return backup;
}

function writeInstructions(file, values) {
  const inspection = inspectConfig(file);
  if (inspection.error) throw new Error(`${file} ${inspection.error}`);
  const current = Array.isArray(inspection.data.instructions) ? inspection.data.instructions : [];
  const next = [...current];
  for (const value of values) if (!next.includes(value)) next.push(value);
  const edits = modify(inspection.text, ['instructions'], next, {
    formattingOptions: { insertSpaces: true, tabSize: 2, eol: '\n' },
  });
  const text = applyEdits(inspection.text, edits);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const backup = backupConfig(file);
  fs.writeFileSync(file, text.endsWith('\n') ? text : `${text}\n`);
  return backup;
}

const posixPath = (value) => value.split(path.sep).join('/');

function homeReference(file, home) {
  const relative = path.relative(home, file);
  return relative.startsWith('..') ? file : `~/${posixPath(relative)}`;
}

function ruleReference(rule, scope, home, project) {
  if (scope === 'global') {
    return homeReference(rule.file, home);
  }
  const relative = path.relative(project, rule.file);
  return relative.startsWith('..') ? rule.file : posixPath(relative);
}

function ruleActions(scanResult, scope, file, inspection) {
  const actions = [];
  const rules = scanResult.rules?.[scope] ?? [];
  if (!rules.length) return actions;
  if (inspection.data.instructions !== undefined
    && (!Array.isArray(inspection.data.instructions)
      || inspection.data.instructions.some((value) => typeof value !== 'string'))) {
    return [{
      label: `${scope} Claude rules`,
      status: 'error',
      note: `${file} instructions must be a string array`,
      preflight: true,
    }];
  }
  const current = new Set(inspection.data.instructions ?? []);
  const pending = [];
  for (const rule of rules) {
    const label = `rule ${path.basename(rule.file, '.md')}`;
    if (rule.pathScoped) {
      actions.push({ label, status: 'skip', note: 'path-scoped Claude rule needs manual review' });
      continue;
    }
    const value = ruleReference(rule, scope, scanResult.home, scanResult.project);
    if (current.has(value)) {
      actions.push({ label, status: 'native', note: `${file} already references it` });
      continue;
    }
    pending.push(value);
  }
  if (pending.length) {
    actions.push({
      label: `${scope} Claude rules`,
      status: 'move',
      note: `reference ${pending.length} rule(s) -> ${file}`,
      kind: 'config',
      src: rules.filter((rule) => !rule.pathScoped).map((rule) => rule.file).join(', '),
      dest: file,
      exec: () => writeInstructions(file, pending),
    });
  }
  return actions;
}

function memoryActions(scanResult, file, inspection) {
  if (!scanResult.autoMemoryFile) return [];
  if (inspection.data.instructions !== undefined
    && (!Array.isArray(inspection.data.instructions)
      || inspection.data.instructions.some((value) => typeof value !== 'string'))) {
    return [{
      label: 'Claude auto memory',
      status: 'error',
      note: `${file} instructions must be a string array`,
      preflight: true,
    }];
  }
  const value = homeReference(scanResult.autoMemoryFile, scanResult.home);
  if ((inspection.data.instructions ?? []).includes(value)) {
    return [{
      label: 'Claude auto memory',
      status: 'native',
      note: `${file} already references it`,
    }];
  }
  return [{
    label: 'Claude auto memory',
    status: 'move',
    note: `live reference -> ${file}`,
    kind: 'config',
    src: scanResult.autoMemoryFile,
    dest: file,
    exec: () => writeInstructions(file, [value]),
  }];
}

function mcpActions(scanResult, scope, file, inspection) {
  const actions = [];
  const pending = [];
  const current = targetServers(inspection.data, inspection.v2);
  for (const server of scanResult.mcpServers.filter((item) => item.scope === scope)) {
    if (Object.prototype.hasOwnProperty.call(current, server.name)) {
      actions.push({ label: `MCP ${server.name}`, status: 'skip', note: `${file} already defines it` });
      continue;
    }
    if (SECRET_RE.test(JSON.stringify(server.cfg))) {
      actions.push({ label: `MCP ${server.name}`, status: 'skip', note: 'plaintext secret detected, not copied' });
      continue;
    }
    const type = server.cfg?.type || 'stdio';
    const valid = (type === 'stdio' && typeof server.cfg?.command === 'string' && server.cfg.command)
      || (['http', 'streamable-http', 'remote'].includes(type) && typeof server.cfg?.url === 'string' && server.cfg.url);
    if (!valid) {
      actions.push({ label: `MCP ${server.name}`, status: 'skip', note: 'malformed source config, not copied' });
      continue;
    }
    pending.push({ name: server.name, value: claudeMcpToOpenCode(server.cfg, { v2: inspection.v2 }) });
  }
  if (pending.length) {
    actions.push({
      label: `${scope === 'user' ? 'global' : 'project'} MCP config`,
      status: 'move',
      note: `merge ${pending.length} server(s) -> ${file}`,
      kind: 'config',
      src: scanResult.mcpServers.filter((item) => item.scope === scope).map((item) => item.sourcePath).join(', '),
      dest: file,
      exec: () => writeServers(file, inspection, pending),
    });
  }
  return actions;
}

function hookActions(scanResult, openCodeRoot) {
  if (!scanResult.hookConfigs.length) return [];
  const summary = inspectOpenCodeHookBridge(scanResult.hookConfigs);
  const actions = [];
  if (summary.supported) {
    const dest = path.join(openCodeRoot, 'plugins', 'claude-hooks.js');
    const action = generatedFileAction(
      'Claude command hooks',
      scanResult.hookConfigs.map((config) => config.file).join(', '),
      dest,
      renderOpenCodeHookPlugin(),
      'plugin',
    );
    if (action.status === 'move') {
      action.note = `live bridge ${summary.supported} PreToolUse/PostToolUse command hook(s) -> ${dest}`;
    }
    actions.push(action);
  }
  if (summary.skipped) {
    const events = summary.unsupportedEvents.length
      ? ` including ${summary.unsupportedEvents.join(', ')}`
      : '';
    actions.push({
      label: 'Claude hook gaps',
      status: 'skip',
      note: `${summary.skipped} unsupported handler(s) stay manual${events}`,
    });
  }
  return actions;
}

export function planOpenCodeActions(scanResult, { copy = false, hooksOnly = false } = {}) {
  const home = scanResult.home || os.homedir();
  const project = scanResult.project || process.cwd();
  const openCodeRoot = path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'opencode');
  if (hooksOnly) return hookActions(scanResult, openCodeRoot);
  const globalConfig = configPath(openCodeRoot);
  const projectConfig = configPath(project);
  const globalInspection = inspectConfig(globalConfig);
  const projectInspection = inspectConfig(projectConfig);
  const actions = [];

  for (const [file, inspection] of [[globalConfig, globalInspection], [projectConfig, projectInspection]]) {
    if (inspection.error) {
      actions.push({
        label: path.basename(file),
        status: 'error',
        note: `${file} ${inspection.error}`,
        preflight: true,
      });
    }
  }

  if (scanResult.globalClaudeMd) {
    actions.push(linkAction('CLAUDE.md global', scanResult.globalClaudeMd, path.join(openCodeRoot, 'AGENTS.md'), copy));
  }
  if (scanResult.projectClaudeMd) {
    actions.push(linkAction('CLAUDE.md project', scanResult.projectClaudeMd, path.join(project, 'AGENTS.md'), copy));
  }

  for (const skill of [...scanResult.skills.global, ...scanResult.skills.project]) {
    actions.push({ label: `skill ${skill.name}`, status: 'native', note: 'OpenCode reads the Claude skill directory directly' });
  }

  for (const [scope, files] of Object.entries(scanResult.commands)) {
    const root = scope === 'global' ? path.join(openCodeRoot, 'commands') : path.join(project, '.opencode', 'commands');
    for (const file of files) {
      const name = path.basename(file);
      actions.push(fileAction(`command /${path.basename(file, '.md')}`, file, path.join(root, name)));
    }
  }

  for (const [scope, files] of Object.entries(scanResult.agents)) {
    const root = scope === 'global' ? path.join(openCodeRoot, 'agents') : path.join(project, '.opencode', 'agents');
    for (const file of files) {
      const name = path.basename(file);
      const converted = claudeAgentToOpenCode(fs.readFileSync(file, 'utf8'), path.basename(file, '.md'));
      const action = fileAction(`agent ${path.basename(file, '.md')}`, file, path.join(root, name), (value) => claudeAgentToOpenCode(value, path.basename(file, '.md')).text);
      if (converted.needsReview && action.status === 'move') action.note += ', source tool permissions need manual review';
      actions.push(action);
    }
  }

  if (!globalInspection.error) actions.push(...mcpActions(scanResult, 'user', globalConfig, globalInspection));
  if (!projectInspection.error) actions.push(...mcpActions(scanResult, 'project', projectConfig, projectInspection));
  if (!globalInspection.error) actions.push(...ruleActions(scanResult, 'global', globalConfig, globalInspection));
  if (!projectInspection.error) actions.push(...ruleActions(scanResult, 'project', projectConfig, projectInspection));
  if (!projectInspection.error) actions.push(...memoryActions(scanResult, projectConfig, projectInspection));

  actions.push(...hookActions(scanResult, openCodeRoot));
  if (scanResult.permissionRules) {
    actions.push({ label: 'Claude permissions', status: 'skip', note: 'OpenCode permission semantics differ, review manually' });
  }
  return actions;
}

export function applyOpenCodeActions(actions, scanResult) {
  if (actions.some((action) => action.preflight && action.status === 'error')) return actions;
  for (const action of actions) {
    if (action.status !== 'move') continue;
    try {
      const backup = action.exec();
      action.status = 'done';
      if (backup) action.note += `, backup ${backup}`;
    } catch (error) {
      if ((error.code === 'EPERM' || error.code === 'EACCES') && action.fallback) {
        try {
          action.fallback();
          action.status = 'done';
          action.note = action.fallbackNote;
          continue;
        } catch (fallbackError) {
          error = fallbackError;
        }
      }
      action.status = 'error';
      action.note = String(error.message || error);
    }
  }
  const moved = actions.filter((action) => action.kind && action.status === 'done')
    .map((action) => ({ kind: action.kind, label: action.label, source: action.src, dest: action.dest }));
  if (moved.length) {
    const home = scanResult.home || os.homedir();
    const root = path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'opencode');
    const file = path.join(root, 'dsh-movein-manifest.json');
    let runs = [];
    try { runs = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* fresh manifest */ }
    runs.push({ at: new Date().toISOString(), from: 'claude', to: 'opencode', project: scanResult.project, moved });
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(runs, null, 2) + '\n');
  }
  return actions;
}

const pad = (value, width) => value.length >= width
  ? value
  : value + ' ' + '.'.repeat(Math.max(0, width - value.length - 2)) + ' ';

export function renderOpenCodeReport(scanResult, actions, { apply = false, hooksOnly = false } = {}) {
  const title = hooksOnly
    ? '📦 claude-to-opencode · Claude hooks -> OpenCode guardrails'
    : '📦 claude-to-opencode · Claude Code -> OpenCode safe move';
  const lines = ['', title, ''];
  const icon = { native: '✓', move: '→', done: '✓', skip: '−', error: '✗' };
  for (const action of actions) {
    lines.push(`  ${icon[action.status] || '·'} ${pad(action.label, 34)}${action.note}`);
  }
  if (!actions.length) lines.push('  − nothing found to move');
  lines.push('');
  const hooks = inspectOpenCodeHookBridge(scanResult.hookConfigs).supported;
  lines.push(hooksOnly
    ? `  found ${hooks} supported command hooks`
    : `  found ${scanResult.skills.global.length + scanResult.skills.project.length} skills · ${scanResult.commands.global.length + scanResult.commands.project.length} commands · ${scanResult.agents.global.length + scanResult.agents.project.length} agents · ${scanResult.mcpServers.length} MCP servers · ${(scanResult.rules?.global.length ?? 0) + (scanResult.rules?.project.length ?? 0)} rules · ${scanResult.autoMemoryFile ? 1 : 0} memory · ${hooks} hooks`);
  if (scanResult.sessionCount) lines.push('  ○ sessions stay in Claude Code');
  lines.push('');
  if (!apply) {
    lines.push('  dry run only. Re-run with --apply when the paths look right.');
  } else if (actions.some((action) => action.preflight && action.status === 'error')) {
    lines.push('  invalid OpenCode config blocked every write.');
  } else {
    const errors = actions.filter((action) => action.status === 'error');
    lines.push(errors.length
      ? `  finished with ${errors.length} error(s).`
      : '  moved. Start OpenCode and check the slash command and agent pickers.');
  }
  lines.push('');
  return lines.join('\n');
}
