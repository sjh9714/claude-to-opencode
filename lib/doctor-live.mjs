import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const exists = (file) => { try { fs.lstatSync(file); return true; } catch { return false; } };
const NEVER = new Promise(() => {});
const DUMP_LIMIT_BYTES = 65_536;
const MINIMUM_DSH_VERSION = '0.1.1-rc.2';

function removeIsolatedHome(root, profile) {
  // Explicitly unlink the package junction before recursive cleanup so even
  // Windows never has a chance to traverse into the user's installation.
  const modulesLink = path.join(root, 'profiles', profile, 'node_modules');
  let modulesStat = null;
  try { modulesStat = fs.lstatSync(modulesLink); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (modulesStat) {
    if (!modulesStat.isSymbolicLink()) throw new Error(`refusing to recursively remove unexpected path ${modulesLink}`);
    fs.unlinkSync(modulesLink);
  }
  fs.rmSync(root, { recursive: true, force: true });
}

function installedDsh(dshHome, profile) {
  const candidates = [
    path.join(dshHome, 'profiles', profile, 'node_modules', '@deepseek-ai', 'dsh', 'package.json'),
    path.join(dshHome, 'profiles', 'node_modules', '@deepseek-ai', 'dsh', 'package.json'),
  ];
  for (const packagePath of candidates) {
    try {
      const manifest = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      if (manifest.name !== '@deepseek-ai/dsh') continue;
      const relative = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.dsh;
      if (typeof relative !== 'string') continue;
      const binary = path.resolve(path.dirname(packagePath), relative);
      if (exists(binary)) return {
        binary,
        displayPath: path.relative(dshHome, binary),
        version: manifest.version || 'unknown',
      };
    } catch { /* try the next installed location */ }
  }
  return null;
}

function supportedDshRuntime(version) {
  const match = String(version).match(/^(\d+)\.(\d+)\./);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major >= 24 || (major === 22 && minor >= 19);
}

function supportedDshVersion(version) {
  const match = String(version).match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) return false;
  const core = match.slice(1, 4).map(Number);
  const minimum = [0, 1, 1];
  for (let index = 0; index < core.length; index += 1) {
    if (core[index] > minimum[index]) return true;
    if (core[index] < minimum[index]) return false;
  }
  if (!match[4]) return true;
  const prerelease = match[4].split('.');
  return prerelease[0] === 'rc'
    && /^\d+$/.test(prerelease[1] || '')
    && Number(prerelease[1]) >= 2;
}

// DSH rc.2 rewrites profiles/<name>/cordis.yml on every boot. Run it against
// a disposable home so a health check cannot mutate the user's live profile.
function isolateDshHome(dshHome, profile) {
  const sourceProfile = path.join(dshHome, 'profiles', profile);
  const sourceModules = path.join(sourceProfile, 'node_modules');
  const required = ['package.json', 'cordis.yml'];
  for (const name of required) {
    if (!exists(path.join(sourceProfile, name))) throw new Error(`profile ${profile} is missing ${name}`);
  }
  if (!exists(sourceModules)) throw new Error(`profile ${profile} has no installed node_modules`);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-movein-live-'));
  try {
    const targetProfile = path.join(root, 'profiles', profile);
    fs.mkdirSync(targetProfile, { recursive: true });
    for (const name of ['package.json', 'cordis.yml', 'cordis.patch.yml', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']) {
      const source = path.join(sourceProfile, name);
      if (exists(source)) fs.copyFileSync(source, path.join(targetProfile, name));
    }
    const homePatch = path.join(dshHome, 'cordis.patch.yml');
    if (exists(homePatch)) fs.copyFileSync(homePatch, path.join(root, 'cordis.patch.yml'));

    // Profile packages are read in place. The shared fallback at
    // root/profiles/node_modules is deliberately NOT linked: DSH may heal it,
    // and those writes must stay inside this disposable home.
    fs.symlinkSync(sourceModules, path.join(targetProfile, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    const cwd = path.join(root, 'workspace');
    const agentsHome = path.join(root, 'agents');
    const userHome = path.join(root, 'home');
    const appData = path.join(root, 'appdata');
    const localAppData = path.join(root, 'local-appdata');
    const xdgConfigHome = path.join(root, 'xdg-config');
    const xdgCacheHome = path.join(root, 'xdg-cache');
    const temp = path.join(root, 'tmp');
    for (const directory of [cwd, agentsHome, userHome, appData, localAppData, xdgConfigHome, xdgCacheHome, temp]) {
      fs.mkdirSync(directory);
    }
    return { root, cwd, agentsHome, userHome, appData, localAppData, xdgConfigHome, xdgCacheHome, temp };
  } catch (error) {
    removeIsolatedHome(root, profile);
    throw error;
  }
}

function parseLoopbackUrl(text) {
  const plain = text.replace(/\u001b\[[0-9;]*m/g, '');
  const match = plain.match(/(?:^|\n)dsh web:\s+(https?:\/\/\S+)/m);
  if (!match) return null;
  let url;
  try { url = new URL(match[1]); } catch { throw new Error(`DSH printed an invalid URL: ${match[1]}`); }
  const loopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]';
  if (url.protocol !== 'http:' || !loopback || !url.port) {
    throw new Error(`DSH printed a non-loopback readiness URL: ${url.href}`);
  }
  return url;
}

function nonemptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function optionalStringArray(value) {
  return value === undefined || (Array.isArray(value) && value.every((item) => typeof item === 'string'));
}

function validBootWire(boot) {
  return typeof boot === 'object'
    && boot !== null
    && nonemptyString(boot.rev)
    && Array.isArray(boot.entries)
    && boot.entries.length > 0
    && boot.entries.every((entry) => typeof entry === 'object'
      && entry !== null
      && nonemptyString(entry.id)
      && nonemptyString(entry.url)
      && nonemptyString(entry.rev)
      && optionalStringArray(entry.inject)
      && optionalStringArray(entry.external)
      && (entry.immediately === undefined || typeof entry.immediately === 'boolean'));
}

function requestPage(url, timeoutMs) {
  return new Promise((resolve) => {
    const req = http.get(url, { headers: { accept: 'text/html' } }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        if (body.length < 1_048_576) body += chunk.slice(0, 1_048_576 - body.length);
      });
      response.once('end', () => {
        const contentType = String(response.headers['content-type'] || '');
        const assignment = body.match(/globalThis\["__DSH_BOOT__"\]\s*=\s*([^<]+)<\/script>/);
        let boot = null;
        try { if (assignment) boot = JSON.parse(assignment[1].trim()); } catch { /* malformed payload is not ready */ }
        const validBoot = validBootWire(boot);
        let assetUrl = null;
        if (validBoot) {
          for (const entry of boot.entries) {
            if (typeof entry?.url !== 'string') continue;
            try {
              const candidate = new URL(entry.url, url);
              if (candidate.origin === url.origin && candidate.protocol === 'http:') { assetUrl = candidate; break; }
            } catch { /* try the next wire entry */ }
          }
        }
        resolve({
          reachable: true,
          status: response.statusCode,
          contentType,
          validBoot,
          assetUrl,
          ready: response.statusCode === 200 && /^text\/html(?:\s*;|$)/i.test(contentType) && validBoot && assetUrl !== null,
        });
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('HTTP probe timed out')));
    req.once('error', (error) => resolve({ reachable: false, ready: false, error }));
  });
}

function requestJavascript(url, timeoutMs) {
  return new Promise((resolve) => {
    const req = http.get(url, { headers: { accept: 'text/javascript, application/javascript' } }, (response) => {
      let bytes = 0;
      response.on('data', (chunk) => { bytes += chunk.length; });
      response.once('end', () => {
        const contentType = String(response.headers['content-type'] || '');
        resolve({
          reachable: true,
          status: response.statusCode,
          contentType,
          ready: response.statusCode === 200 && /^(?:text|application)\/javascript(?:\s*;|$)/i.test(contentType) && bytes > 0,
        });
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('JavaScript probe timed out')));
    req.once('error', (error) => resolve({ reachable: false, ready: false, error }));
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function abortPromise(signal) {
  if (!signal) return NEVER;
  if (signal.aborted) return Promise.resolve({ type: 'abort', reason: signal.reason });
  return new Promise((resolve) => signal.addEventListener('abort', () => resolve({ type: 'abort', reason: signal.reason }), { once: true }));
}

function signalChild(child, signal, detached) {
  if (!child?.pid) return false;
  try {
    if (detached) process.kill(-child.pid, signal);
    else child.kill(signal);
    return true;
  } catch {
    return false;
  }
}

async function stopChild(child, state, terminalPromise, { detached, timeoutMs }) {
  if (state.terminal) return { already: true, clean: state.terminal.type === 'exit', terminal: state.terminal };
  signalChild(child, 'SIGTERM', detached);
  let terminal = await Promise.race([terminalPromise, wait(timeoutMs).then(() => null)]);
  if (terminal) return {
    clean: terminal.type === 'exit' && (terminal.code === 0 || terminal.signal === 'SIGTERM'),
    terminal,
  };
  signalChild(child, 'SIGKILL', detached);
  terminal = await Promise.race([terminalPromise, wait(timeoutMs).then(() => null)]);
  return { clean: false, forced: true, terminal };
}

function diagnostic(output) {
  const oneLine = output
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/((?:api[_-]?key|token|secret|password|credential|authorization)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|\S+)/gi, '$1[redacted]')
    .replace(/\s+/g, ' ')
    .trim();
  return oneLine ? `: ${oneLine.slice(-300)}` : '';
}

function startupDiagnostic(output, failure) {
  const detail = diagnostic(output);
  if (!failure.nativeBinding && !failure.hostPackage) return detail;
  const cause = failure.nativeBinding
    ? 'installed DSH could not load its native binding'
    : 'official DSH package imports failed; a host dependency or native-loader resolution problem is possible';
  return `${detail}; ${cause}. This official-only baseline does not activate migrated configuration. Check the DSH installation and its native optional dependencies; compare a separate local npm or pnpm hoisted installation. Do not delete the migration profile or disable package-manager security checks`;
}

function allowlistedChildEnv(env) {
  const clean = {};
  const allowed = new Set([
    'PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT',
    'LANG', 'LANGUAGE', 'LC_ALL', 'LC_CTYPE', 'LC_COLLATE', 'LC_MESSAGES',
    'LC_MONETARY', 'LC_NUMERIC', 'LC_TIME', 'LC_PAPER', 'LC_NAME',
    'LC_ADDRESS', 'LC_TELEPHONE', 'LC_MEASUREMENT', 'LC_IDENTIFICATION', 'TZ',
  ]);
  for (const [name, value] of Object.entries(env)) {
    if (allowed.has(name) && typeof value === 'string') clean[name] = value;
  }
  return clean;
}

function childEnvironment(snapshot, env) {
  return {
    ...allowlistedChildEnv(env),
    HOME: snapshot.userHome,
    USERPROFILE: snapshot.userHome,
    APPDATA: snapshot.appData,
    LOCALAPPDATA: snapshot.localAppData,
    XDG_CONFIG_HOME: snapshot.xdgConfigHome,
    XDG_CACHE_HOME: snapshot.xdgCacheHome,
    TEMP: snapshot.temp,
    TMP: snapshot.temp,
    TMPDIR: snapshot.temp,
    DSH_HOME: snapshot.root,
    DSH_AGENTS_HOME: snapshot.agentsHome,
    DSH_TELEMETRY_DISABLED: '1',
  };
}

function trackChild(child) {
  const state = { terminal: null };
  const terminalPromise = new Promise((resolve) => {
    child.once('error', (error) => { state.terminal = { type: 'error', error }; resolve(state.terminal); });
    child.once('exit', (code, signal) => { state.terminal = { type: 'exit', code, signal }; resolve(state.terminal); });
  });
  return { state, terminalPromise };
}

function captureBoundedStdout(child) {
  const chunks = [];
  let bytes = 0;
  let overflow = false;
  const done = child.stdout
    ? new Promise((resolve) => {
      child.stdout.once('end', resolve);
      child.stdout.once('error', resolve);
    })
    : Promise.resolve();
  child.stdout?.on('data', (chunk) => {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const remaining = DUMP_LIMIT_BYTES - bytes;
    if (data.length > remaining) overflow = true;
    if (remaining > 0) {
      const kept = Buffer.from(data.subarray(0, remaining));
      chunks.push(kept);
      bytes += kept.length;
    }
  });
  child.stderr?.resume();
  return {
    done,
    take() {
      const stdout = Buffer.concat(chunks, bytes).toString('utf8');
      chunks.length = 0;
      bytes = 0;
      return { stdout, overflow };
    },
  };
}

function validDumpOutput(stdout, overflow) {
  if (overflow) return { valid: false, reason: `stdout exceeded ${DUMP_LIMIT_BYTES / 1024} KiB` };
  if (!stdout.trim()) return { valid: false, reason: 'stdout was empty' };
  if (!/(?:^|\r?\n)# == [^\r\n]+\r?\n-\s+\S/m.test(stdout)) {
    return { valid: false, reason: 'stdout did not contain the expected # == section and YAML-list signature' };
  }
  return { valid: true };
}

async function composeWithoutActivation({
  installation,
  snapshot,
  timeoutMs,
  shutdownTimeoutMs,
  signal,
  env,
  spawnProcess,
  platform,
  purpose,
}) {
  const capability = purpose === 'capability';
  const label = capability ? 'live DSH dump capability' : 'live DSH composition';
  let child;
  try {
    child = spawnProcess(process.execPath, [installation.binary, 'web', '--dump-config'], {
      cwd: snapshot.cwd,
      detached: platform !== 'win32',
      env: childEnvironment(snapshot, env),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
  } catch (error) {
    return {
      check: { level: 'bad', label, note: `could not start boot-free config dump: ${error.message}` },
      cleanupConfirmed: true,
    };
  }

  const { state, terminalPromise } = trackChild(child);
  const capture = captureBoundedStdout(child);
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve({ type: 'timeout' }), timeoutMs); });
  const outcome = await Promise.race([terminalPromise, timeout, abortPromise(signal)]);
  clearTimeout(timer);
  const outputDrained = outcome.type !== 'exit' || await Promise.race([
    capture.done.then(() => true),
    wait(shutdownTimeoutMs).then(() => false),
  ]);
  const captured = capture.take();

  if (outcome.type === 'exit') {
    const dump = validDumpOutput(captured.stdout, captured.overflow);
    captured.stdout = '';
    return {
      check: !outputDrained
        ? { level: 'bad', label, note: 'boot-free config dump child exited but its stdout pipe remained open; bounded output discarded' }
        : outcome.code !== 0
          ? { level: 'bad', label, note: `boot-free config dump exited with code ${outcome.code ?? 'none'}${outcome.signal ? ` (${outcome.signal})` : ''}; bounded output discarded` }
          : !dump.valid
            ? { level: 'bad', label, note: `boot-free config dump ${dump.reason}; bounded output discarded` }
            : capability
              ? { level: 'ok', label, note: 'installed DSH proved boot-free config-dump capability on an official base/web-only snapshot; bounded output validated and discarded' }
              : { level: 'ok', label, note: 'active migration config composed without activation; bounded output validated and discarded' },
      cleanupConfirmed: outputDrained,
    };
  }
  captured.stdout = '';
  if (outcome.type === 'error') {
    return {
      check: { level: 'bad', label, note: `boot-free config dump could not start: ${outcome.error.message}` },
      cleanupConfirmed: !child.pid,
    };
  }

  const stop = await stopChild(child, state, terminalPromise, {
    detached: platform !== 'win32', timeoutMs: shutdownTimeoutMs,
  });
  const cleanupConfirmed = cleanupContained(stop);
  return {
    check: {
      level: 'bad',
      label,
      note: outcome.type === 'abort'
        ? `boot-free config dump interrupted${outcome.reason ? ` by ${outcome.reason}` : ''}; ${cleanupConfirmed ? 'child exited' : 'cleanup unconfirmed'}`
        : `boot-free config dump timed out after ${timeoutMs}ms; ${cleanupConfirmed ? 'child exited' : 'cleanup unconfirmed'}`,
    },
    aborted: outcome.type === 'abort',
    cleanupConfirmed,
  };
}

function stageOfficialWebBaseline(snapshot, profile) {
  const profileDir = path.join(snapshot.root, 'profiles', profile);
  const packagePath = path.join(profileDir, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  manifest.dsh = manifest.dsh && typeof manifest.dsh === 'object' ? manifest.dsh : {};
  manifest.dsh.profile = manifest.dsh.profile && typeof manifest.dsh.profile === 'object' ? manifest.dsh.profile : {};
  manifest.dsh.profile.bundles = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'];
  fs.writeFileSync(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(profileDir, 'cordis.yml'), '[]\n');
  fs.writeFileSync(path.join(profileDir, 'cordis.patch.yml'), '[]\n');
  fs.writeFileSync(path.join(snapshot.root, 'cordis.patch.yml'), '[]\n');
}

function httpDetail(result) {
  if (!result) return '';
  if (result.status !== 200) return `HTTP ${result.status ?? 'unknown'}`;
  if (!/^text\/html(?:\s*;|$)/i.test(result.contentType || '')) return `HTTP 200 ${result.contentType || 'without Content-Type'}`;
  if (!result.validBoot) return 'HTTP 200 with an invalid __DSH_BOOT__ wire shape';
  if (!result.assetUrl) return 'HTTP 200 without a same-origin client entry';
  return 'HTTP 200';
}

async function waitForHttp(url, { deadline, terminalPromise, timeoutPromise, aborted, request }) {
  let last = null;
  while (Date.now() < deadline) {
    const remaining = Math.max(1, deadline - Date.now());
    const result = await Promise.race([
      request(url, Math.min(750, remaining)).then((value) => ({ type: 'http', value })),
      terminalPromise,
      timeoutPromise,
      aborted,
    ]);
    if (result.type !== 'http') return result.type === 'timeout' ? { ...result, last } : result;
    last = result.value;
    if (last.ready) return { type: 'ready', value: last };
    await wait(Math.min(100, Math.max(1, deadline - Date.now())));
  }
  return { type: 'timeout', last };
}

function javascriptDetail(result) {
  if (!result) return '';
  if (result.status !== 200) return `JavaScript HTTP ${result.status ?? 'unknown'}`;
  if (!/^(?:text|application)\/javascript(?:\s*;|$)/i.test(result.contentType || '')) {
    return `JavaScript HTTP 200 ${result.contentType || 'without Content-Type'}`;
  }
  return 'empty JavaScript HTTP 200';
}

function cleanupPhrase(stop) {
  if (stop.terminal?.type !== 'exit') return 'cleanup unconfirmed';
  return stop.clean ? 'stopped cleanly' : 'required forced cleanup';
}

function cleanupContained(stop) {
  return stop.terminal?.type === 'exit';
}

async function portWasReleased(url, request = requestPage) {
  const deadline = Date.now() + 1_000;
  while (Date.now() < deadline) {
    const result = await request(url, 200);
    if (!result.reachable) return true;
    await wait(50);
  }
  return false;
}

async function observeWebCleanup(stop, url, request) {
  const childExited = cleanupContained(stop);
  const portReleased = childExited && url ? await portWasReleased(url, request) : url === null;
  return { childExited, portReleased, confirmed: childExited && portReleased };
}

function observedCleanupPhrase(stop, observed) {
  if (!observed.childExited) return 'cleanup unconfirmed';
  if (!observed.portReleased) return 'cleanup unconfirmed because the loopback port remained reachable';
  return cleanupPhrase(stop);
}

export async function runLiveDoctor({
  home = os.homedir(),
  dshHome = undefined,
  profile = 'web',
  timeoutMs = 20_000,
  shutdownTimeoutMs = 7_000,
  signal = undefined,
  env = process.env,
  nodeVersion = process.versions.node,
  spawnProcess = spawn,
  platform = process.platform,
  pageRequest = requestPage,
  javascriptRequest = requestJavascript,
} = {}) {
  dshHome = dshHome || env.DSH_HOME || path.join(home, '.dsh');
  const checks = [];
  const installation = installedDsh(dshHome, profile);
  if (!installation) {
    checks.push({ level: 'bad', label: 'live DSH web', note: '@deepseek-ai/dsh is not installed under DSH_HOME/profiles; no download attempted' });
    return checks;
  }
  if (!supportedDshVersion(installation.version)) {
    checks.push({ level: 'bad', label: 'live DSH dump capability', note: `installed DSH ${installation.version} predates the known-safe ${MINIMUM_DSH_VERSION} boot-free dump contract; child not started` });
    return checks;
  }
  if (!supportedDshRuntime(nodeVersion)) {
    checks.push({ level: 'bad', label: 'live DSH runtime', note: `installed DSH runtime unsupported on Node ${nodeVersion}; live boot requires Node 22.19+ or 24+ (Node 23 is unsupported), child not started` });
    return checks;
  }
  if (signal?.aborted) {
    checks.push({ level: 'bad', label: 'live DSH composition', note: `interrupted${signal.reason ? ` by ${signal.reason}` : ''} before any child started` });
    return checks;
  }

  let capabilityHome = null;
  let capabilityPassed = false;
  let preserveCapabilitySnapshot = false;
  try {
    capabilityHome = isolateDshHome(dshHome, profile);
    stageOfficialWebBaseline(capabilityHome, profile);
    const capability = await composeWithoutActivation({
      installation,
      snapshot: capabilityHome,
      timeoutMs,
      shutdownTimeoutMs,
      signal,
      env,
      spawnProcess,
      platform,
      purpose: 'capability',
    });
    checks.push(capability.check);
    if (!capability.cleanupConfirmed) {
      preserveCapabilitySnapshot = true;
      checks.push({ level: 'bad', label: 'live DSH cleanup', note: 'dump-capability child termination unconfirmed; temporary snapshot preserved' });
    } else {
      capabilityPassed = capability.check.level === 'ok' && !capability.aborted;
    }
  } catch (error) {
    checks.push({ level: 'bad', label: 'live DSH dump capability', note: `could not validate the safe boot-free dump contract: ${error.message}` });
  } finally {
    if (capabilityHome && !preserveCapabilitySnapshot) {
      try { removeIsolatedHome(capabilityHome.root, profile); }
      catch (error) {
        capabilityPassed = false;
        checks.push({ level: 'bad', label: 'live DSH cleanup', note: `dump-capability snapshot could not be removed: ${error.message}` });
      }
    }
  }
  if (!capabilityPassed) return checks;
  if (signal?.aborted) {
    checks.push({ level: 'bad', label: 'live DSH composition', note: `interrupted${signal.reason ? ` by ${signal.reason}` : ''} before the active config child started` });
    return checks;
  }

  let isolatedHome;
  try {
    isolatedHome = isolateDshHome(dshHome, profile);
  } catch (error) {
    checks.push({ level: 'bad', label: 'live DSH web', note: `could not create a read-only profile snapshot; original profile was not started: ${error.message}` });
    return checks;
  }

  const detached = platform !== 'win32';
  let child = null;
  let state = { terminal: null };
  let terminalPromise = NEVER;
  let stopped = false;
  let preserveSnapshot = false;
  let url = null;
  let output = '';
  const startupFailure = { nativeBinding: false, hostPackage: false };
  let timer;
  try {
    const composition = await composeWithoutActivation({
      installation,
      snapshot: isolatedHome,
      timeoutMs,
      shutdownTimeoutMs,
      signal,
      env,
      spawnProcess,
      platform,
      purpose: 'active',
    });
    checks.push(composition.check);
    if (!composition.cleanupConfirmed) {
      preserveSnapshot = true;
      checks.push({ level: 'bad', label: 'live DSH cleanup', note: 'composition child termination unconfirmed; temporary snapshot preserved' });
      return checks;
    }
    if (composition.aborted) return checks;
    if (signal?.aborted) {
      checks.push({ level: 'bad', label: 'live DSH web baseline', note: `interrupted${signal.reason ? ` by ${signal.reason}` : ''} before baseline child started` });
      return checks;
    }

    try { stageOfficialWebBaseline(isolatedHome, profile); }
    catch (error) {
      checks.push({ level: 'bad', label: 'live DSH web baseline', note: `could not stage the official base/web-only baseline: ${error.message}` });
      return checks;
    }
    if (signal?.aborted) {
      checks.push({ level: 'bad', label: 'live DSH web baseline', note: `interrupted${signal.reason ? ` by ${signal.reason}` : ''} before baseline child started` });
      return checks;
    }

    child = spawnProcess(process.execPath, [installation.binary, 'web', '--no-open', '--host', '127.0.0.1', '--port', '0'], {
      cwd: isolatedHome.cwd,
      detached,
      env: childEnvironment(isolatedHome, env),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    ({ state, terminalPromise } = trackChild(child));

    let resolveUrl;
    const urlPromise = new Promise((resolve) => { resolveUrl = resolve; });
    const collectOutput = (chunk) => {
      const combined = output + chunk.toString();
      const plain = combined.replace(/\u001b\[[0-9;]*m/g, '');
      // Keep only classification flags when an early error leaves the bounded
      // output tail. Never retain or repeat complete host logs or config dumps.
      startupFailure.nativeBinding ||= /No usable native binding found for node-addon-(?:require-builtin|internal-loader)(?:-[a-z0-9-]+)?\b/i.test(plain);
      startupFailure.hostPackage ||= /Cannot find (?:package|module) ['"]@deepseek-ai\/(?:dsh|cordis)(?:-[a-z0-9-]+)?['"]/i.test(plain);
      output = combined.slice(-8_192);
    };
    const collect = (chunk) => {
      collectOutput(chunk);
      try {
        const parsed = parseLoopbackUrl(output);
        if (parsed) resolveUrl({ type: 'url', url: parsed });
      } catch (error) {
        resolveUrl({ type: 'url-error', error });
      }
    };
    child.stdout?.on('data', collect);
    child.stderr?.on('data', collectOutput);

    const deadline = Date.now() + timeoutMs;
    const timeoutPromise = new Promise((resolve) => { timer = setTimeout(() => resolve({ type: 'timeout' }), timeoutMs); });
    const aborted = abortPromise(signal);
    let outcome = await Promise.race([urlPromise, terminalPromise, timeoutPromise, aborted]);
    if (outcome.type === 'url') {
      url = outcome.url;
      outcome = await waitForHttp(url, { deadline, terminalPromise, timeoutPromise, aborted, request: pageRequest });
    }
    if (outcome.type === 'ready') {
      const page = outcome.value;
      const asset = await waitForHttp(page.assetUrl, { deadline, terminalPromise, timeoutPromise, aborted, request: javascriptRequest });
      outcome = asset.type === 'ready'
        ? { type: 'ready', page, asset: asset.value }
        : { ...asset, page, assetStage: true };
    }
    clearTimeout(timer);

    if (outcome.type === 'ready') {
      // A just-ready process may still be in the middle of exiting. Give the
      // retained child handle one short turn before declaring it stable.
      await wait(25);
      if (state.terminal || child.exitCode !== null || child.signalCode !== null) {
        stopped = true;
        const terminal = state.terminal?.type === 'exit'
          ? state.terminal
          : { type: 'exit', code: child.exitCode, signal: child.signalCode };
        const observed = await observeWebCleanup({ terminal, clean: true }, url, pageRequest);
        if (!observed.confirmed) {
          preserveSnapshot = true;
          checks.push({ level: 'bad', label: 'live DSH cleanup', note: `${observedCleanupPhrase({ terminal, clean: true }, observed)}; temporary snapshot preserved` });
        }
        checks.push({ level: 'bad', label: 'live DSH web baseline', note: 'official baseline served readiness but exited before cleanup verification' });
        return checks;
      }
      const stop = await stopChild(child, state, terminalPromise, { detached, timeoutMs: shutdownTimeoutMs });
      stopped = true;
      const observed = await observeWebCleanup(stop, url, pageRequest);
      if (!observed.confirmed) preserveSnapshot = true;
      if (stop.already) {
        checks.push({ level: 'bad', label: 'live DSH cleanup', note: 'the isolated DSH process exited before the cleanup signal could be verified' });
      } else if (!stop.clean) {
        checks.push({ level: 'bad', label: 'live DSH cleanup', note: `official baseline was ready, but ${observedCleanupPhrase(stop, observed)}` });
      } else if (!observed.confirmed) {
        checks.push({ level: 'bad', label: 'live DSH cleanup', note: `official baseline was ready, but ${observedCleanupPhrase(stop, observed)}` });
      } else {
        checks.push({
          level: 'ok',
          label: 'live DSH web baseline',
          note: `${installation.version} (${installation.displayPath}) official base/web-only baseline returned HTTP 200 HTML, valid __DSH_BOOT__, and same-origin JavaScript 200; child exited and the loopback port was released`,
        });
      }
    } else if (outcome.type === 'abort') {
      const stop = await stopChild(child, state, terminalPromise, { detached, timeoutMs: shutdownTimeoutMs });
      stopped = true;
      const observed = await observeWebCleanup(stop, url, pageRequest);
      if (!observed.confirmed) preserveSnapshot = true;
      checks.push({ level: 'bad', label: 'live DSH web baseline', note: `interrupted${outcome.reason ? ` by ${outcome.reason}` : ''}; ${observedCleanupPhrase(stop, observed)}` });
    } else if (outcome.type === 'timeout') {
      const stop = await stopChild(child, state, terminalPromise, { detached, timeoutMs: shutdownTimeoutMs });
      stopped = true;
      const observed = await observeWebCleanup(stop, url, pageRequest);
      if (!observed.confirmed) preserveSnapshot = true;
      const detail = outcome.last
        ? ` (last ${outcome.assetStage ? javascriptDetail(outcome.last) : httpDetail(outcome.last)})`
        : '';
      checks.push({ level: 'bad', label: 'live DSH web baseline', note: `official baseline readiness timed out after ${timeoutMs}ms${detail}; ${observedCleanupPhrase(stop, observed)}${startupDiagnostic(output, startupFailure)}` });
    } else if (outcome.type === 'url-error') {
      const stop = await stopChild(child, state, terminalPromise, { detached, timeoutMs: shutdownTimeoutMs });
      stopped = true;
      const observed = await observeWebCleanup(stop, url, pageRequest);
      if (!observed.confirmed) preserveSnapshot = true;
      checks.push({ level: 'bad', label: 'live DSH web baseline', note: `${outcome.error.message}; ${observedCleanupPhrase(stop, observed)}` });
    } else if (outcome.type === 'error') {
      stopped = true;
      checks.push({ level: 'bad', label: 'live DSH web baseline', note: `could not start installed binary: ${outcome.error.message}` });
    } else {
      stopped = true;
      if (outcome.type === 'exit' && url) {
        const observed = await observeWebCleanup({ terminal: outcome, clean: true }, url, pageRequest);
        if (!observed.confirmed) {
          preserveSnapshot = true;
          checks.push({ level: 'bad', label: 'live DSH cleanup', note: `${observedCleanupPhrase({ terminal: outcome, clean: true }, observed)}; temporary snapshot preserved` });
        }
      }
      checks.push({ level: 'bad', label: 'live DSH web baseline', note: `official baseline startup exited before readiness (code ${outcome.code ?? 'none'}${outcome.signal ? `, ${outcome.signal}` : ''})${startupDiagnostic(output, startupFailure)}` });
    }
  } catch (error) {
    checks.push({ level: 'bad', label: 'live DSH web baseline', note: `probe failed: ${error.message}` });
  } finally {
    clearTimeout(timer);
    if (child && !stopped) {
      const stop = await stopChild(child, state, terminalPromise, { detached, timeoutMs: shutdownTimeoutMs });
      const observed = await observeWebCleanup(stop, url, pageRequest);
      if (!observed.confirmed) preserveSnapshot = true;
      if (!stop.clean && !checks.some((check) => check.label === 'live DSH cleanup')) {
        checks.push({ level: 'bad', label: 'live DSH cleanup', note: observedCleanupPhrase(stop, observed) });
      }
    }
    if (preserveSnapshot) {
      const cleanupCheck = checks.find((check) => check.label === 'live DSH cleanup');
      if (cleanupCheck && !cleanupCheck.note.includes('snapshot preserved')) {
        cleanupCheck.note += '; temporary snapshot preserved';
      } else if (!cleanupCheck) {
        checks.push({ level: 'bad', label: 'live DSH cleanup', note: 'child termination unconfirmed; temporary snapshot preserved' });
      }
    } else {
      try { removeIsolatedHome(isolatedHome.root, profile); }
      catch (error) { checks.push({ level: 'bad', label: 'live DSH cleanup', note: `temporary profile snapshot could not be removed: ${error.message}` }); }
    }
  }
  return checks;
}
