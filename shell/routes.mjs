import path from 'node:path';
import { scan } from '../lib/scan.mjs';
import { scanCodex } from '../lib/codex.mjs';
import { scanOpenCode } from '../lib/opencode.mjs';
import { planActions, applyActions } from '../lib/apply.mjs';
import { renderReport } from '../lib/report.mjs';
import { claimStarPrompt } from '../lib/star.mjs';

export const CATEGORY_IDS = ['instructions', 'skills', 'commands', 'agents', 'hooks', 'permissions', 'mcp'];

function selectedSet(include) {
  if (!Array.isArray(include)) return new Set(CATEGORY_IDS);
  return new Set(include.filter((item) => CATEGORY_IDS.includes(item)));
}

export function filterScanResult(scanResult, include) {
  const selected = selectedSet(include);
  return {
    ...scanResult,
    globalClaudeMd: selected.has('instructions') ? scanResult.globalClaudeMd : null,
    projectClaudeMd: selected.has('instructions') ? scanResult.projectClaudeMd : null,
    skills: selected.has('skills') ? scanResult.skills : { global: [], project: [] },
    commands: selected.has('commands') ? scanResult.commands : { global: [], project: [] },
    inlineCommands: selected.has('commands') ? scanResult.inlineCommands : [],
    agents: selected.has('agents') ? scanResult.agents : { global: [], project: [] },
    inlineAgents: selected.has('agents') ? scanResult.inlineAgents : [],
    hookConfigs: selected.has('hooks') ? scanResult.hookConfigs : [],
    permissionRules: selected.has('permissions') ? scanResult.permissionRules : 0,
    permissions: selected.has('permissions') ? scanResult.permissions : { deny: [], ask: [] },
    mcpServers: selected.has('mcp') ? scanResult.mcpServers : [],
  };
}

function scannerFor(origin) {
  if (origin === 'codex') return scanCodex;
  if (origin === 'opencode') return scanOpenCode;
  return scan;
}

function publicActions(actions) {
  return actions.map(({ label, status, note, kind, preflight }) => ({
    label,
    status,
    note,
    ...(kind ? { kind } : {}),
    ...(preflight ? { preflight: true } : {}),
  }));
}

export function runMovein({ project, origin = 'claude', apply = false, copy = false, include } = {}, scanOptions = {}) {
  if (!['claude', 'codex', 'opencode'].includes(origin)) throw new Error('unsupported origin');
  const resolvedProject = typeof project === 'string' && project.trim()
    ? path.resolve(project.trim())
    : process.cwd();
  const raw = scannerFor(origin)({ ...scanOptions, project: resolvedProject });
  const scanResult = filterScanResult(raw, include);
  const actions = planActions(scanResult, { copy });
  if (apply) applyActions(actions, { scanResult });
  const starPrompt = apply && claimStarPrompt(scanResult.dshHome, actions, scanOptions.starRepository);
  return {
    ok: !actions.some((action) => action.status === 'error'),
    applied: apply,
    project: scanResult.project,
    origin: scanResult.origin || 'Claude Code',
    actions: publicActions(actions),
    notices: (scanResult.notices ?? []).map(({ message, sourcePath }) => ({
      message: String(message),
      ...(sourcePath ? { sourcePath: String(sourcePath) } : {}),
    })),
    report: renderReport(scanResult, actions, { apply, starPrompt }),
    starPrompt,
  };
}

function isLoopbackRequest(req) {
  const address = req.socket.remoteAddress ?? '';
  const local = address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
  if (!local) return false;
  const host = (req.headers.host ?? '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  return host === '127.0.0.1' || host === '::1' || host === 'localhost';
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) return undefined;
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return undefined;
  }
}

function sendJson(res, body, status = 200) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

export function registerMoveinRoute(ctx) {
  const handler = async (req, res) => {
    if (!isLoopbackRequest(req)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end();
      return;
    }
    if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
      res.writeHead(415);
      res.end();
      return;
    }
    const payload = await readJsonBody(req);
    if (typeof payload !== 'object' || payload === null) {
      sendJson(res, { ok: false, error: 'invalid request' }, 400);
      return;
    }
    try {
      sendJson(res, runMovein(payload));
    } catch (error) {
      ctx.logger?.warn?.(`dsh-movein settings request failed ${String(error)}`);
      sendJson(res, { ok: false, error: String(error?.message || error) }, 400);
    }
  };
  return ctx.webServer.register({ kind: 'exact', path: '/dsh-movein/run', handler });
}
