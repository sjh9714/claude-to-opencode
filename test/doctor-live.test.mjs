import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runLiveDoctor } from '../lib/doctor-live.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-movein-live-test-'));
const fakeHome = path.join(root, 'home');
const profile = path.join(fakeHome, 'profiles', 'web');
const dshPackage = path.join(fakeHome, 'profiles', 'node_modules', '@deepseek-ai', 'dsh');
const packagePath = path.join(dshPackage, 'package.json');
const modeFile = path.join(dshPackage, 'mode.txt');
const marker = path.join(root, 'marker.txt');
const mcpMarker = path.join(root, 'active-mcp-executed.txt');
fs.mkdirSync(path.join(profile, 'node_modules', 'probe-package'), { recursive: true });
fs.mkdirSync(dshPackage, { recursive: true });
fs.writeFileSync(path.join(profile, 'package.json'), `${JSON.stringify({
  name: 'test-profile',
  dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'test-active-mcp'] } },
})}\n`);
fs.writeFileSync(path.join(profile, 'cordis.yml'), 'original profile root\n');
fs.writeFileSync(path.join(profile, 'node_modules', 'probe-package', 'package.json'), '{"name":"probe-package"}\n');
fs.writeFileSync(path.join(profile, 'cordis.patch.yml'), '- id: profile-generated-row\n');
fs.writeFileSync(path.join(fakeHome, 'cordis.patch.yml'), '- id: migrated-mcp\n  config:\n    command: fake-active-mcp\n    headers:\n      Authorization: inline-secret-never-send\n');

const setVersion = (version) => fs.writeFileSync(packagePath, `${JSON.stringify({
  name: '@deepseek-ai/dsh', version, type: 'module', bin: { dsh: 'bin.mjs' },
})}\n`);
const setMode = (mode) => fs.writeFileSync(modeFile, `${mode}\n`);
setVersion('0.1.1-rc.2');
setMode('success');

fs.writeFileSync(path.join(dshPackage, 'bin.mjs'), `
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
const mode = fs.readFileSync(${JSON.stringify(modeFile)}, 'utf8').trim();
const marker = ${JSON.stringify(marker)};
const mcpMarker = ${JSON.stringify(mcpMarker)};
const sourceCwd = ${JSON.stringify(process.cwd())};
const isDump = process.argv.includes('--dump-config');
const forbidden = [
  'NODE_OPTIONS', 'NODE_PATH', 'NODE_EXTRA_CA_CERTS', 'DATABASE_URL', 'PRIVATE_KEY',
  'GH_PAT', 'JWT_SECRET', 'COOKIE', 'FAKE_API_KEY', 'AWS_SECRET_ACCESS_KEY',
  'INNOCENT_BUT_PRIVATE',
];
for (const name of forbidden) {
  if (Object.hasOwn(process.env, name)) {
    console.error('forbidden environment variable leaked: ' + name);
    process.exit(9);
  }
}
const redirected = [
  'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'XDG_CONFIG_HOME',
  'XDG_CACHE_HOME', 'TEMP', 'TMP', 'TMPDIR', 'DSH_HOME', 'DSH_AGENTS_HOME',
];
const isolatedRoot = fs.realpathSync(process.env.DSH_HOME);
for (const name of redirected) {
  const value = process.env[name];
  const relative = value ? path.relative(isolatedRoot, fs.realpathSync(value)) : '..';
  if (!value || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    console.error('path was not redirected inside DSH_HOME: ' + name);
    process.exit(10);
  }
  if (!fs.statSync(value).isDirectory()) {
    console.error('redirected path is not a directory: ' + name);
    process.exit(11);
  }
}
const isolatedCwd = fs.realpathSync(process.cwd());
if (isolatedCwd === sourceCwd || !isolatedCwd.startsWith(isolatedRoot + path.sep)) {
  console.error('source cwd leaked');
  process.exit(12);
}
const profileDir = path.join(process.env.DSH_HOME, 'profiles', 'web');
fs.writeFileSync(path.join(profileDir, 'cordis.yml'), 'rewritten only in snapshot\\n');
const stagedHomePatch = fs.readFileSync(path.join(process.env.DSH_HOME, 'cordis.patch.yml'), 'utf8');
const stagedProfilePatch = fs.readFileSync(path.join(profileDir, 'cordis.patch.yml'), 'utf8');
const stagedManifest = JSON.parse(fs.readFileSync(path.join(profileDir, 'package.json'), 'utf8'));
const bundles = stagedManifest.dsh?.profile?.bundles;
const stagedPackage = path.join(profileDir, 'node_modules', 'probe-package', 'package.json');
const official = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'];
const isOfficial = JSON.stringify(bundles) === JSON.stringify(official)
  && stagedHomePatch.trim() === '[]'
  && stagedProfilePatch.trim() === '[]';
const validDump = '# == cordis.yml\\n- id: fake\\n  name: fake\\n';
if (isDump) {
  if (isOfficial) {
    fs.appendFileSync(marker, 'capability\\n');
    if (mode === 'capability-fail') process.exit(6);
    if (mode === 'capability-empty') process.exit(0);
    if (mode === 'capability-no-signature') {
      process.stdout.write('- id: fake\\n');
      process.exit(0);
    }
    if (mode === 'capability-overflow') {
      fs.writeSync(1, validDump + 'x'.repeat(70_000));
      process.exit(0);
    }
    process.stdout.write(validDump);
    process.exit(0);
  }
  if (!stagedHomePatch.includes('inline-secret-never-send')
    || !stagedProfilePatch.includes('profile-generated-row')
    || !bundles.includes('test-active-mcp')
    || !fs.existsSync(stagedPackage)) {
    console.error('active patch or installed package was not staged');
    process.exit(13);
  }
  fs.appendFileSync(marker, 'composed\\n');
  if (mode === 'composition-fail') process.exit(6);
  if (mode === 'composition-empty') process.exit(0);
  if (mode === 'composition-no-signature') {
    process.stdout.write('- id: active\\n');
    process.exit(0);
  }
  if (mode === 'composition-overflow') {
    fs.writeSync(1, validDump + 'x'.repeat(70_000));
    process.exit(0);
  }
  process.stdout.write('# == cordis.yml\\n- id: active\\n  config:\\n    token: inline-secret-never-send\\n');
  process.exit(0);
}
if (!isOfficial) {
  fs.writeFileSync(mcpMarker, 'unsafe active migration config booted\\n');
  console.error('safe baseline was not staged');
  process.exit(14);
}
fs.appendFileSync(marker, 'started\\n');
if (mode === 'fail') { console.error('fake startup failure'); process.exit(7); }
let server;
const stop = () => {
  fs.appendFileSync(marker, 'stopped\\n');
  if (server) server.close(() => process.exit(0));
  else process.exit(0);
};
if (mode === 'stubborn') process.on('SIGTERM', () => fs.appendFileSync(marker, 'ignored SIGTERM\\n'));
else process.on('SIGTERM', stop);
process.on('SIGINT', stop);
if (mode === 'timeout' || mode === 'stubborn') setInterval(() => {}, 1000);
else {
  server = http.createServer((request, response) => {
    if (request.url.startsWith('/plugins/fake/client.js')) {
      fs.appendFileSync(marker, 'asset fetched\\n');
      response.statusCode = 200;
      response.setHeader('content-type', 'application/javascript; charset=utf-8');
      response.end('globalThis.fakePlugin = true;', () => {
        if (mode === 'exit-after-readiness') process.exit(0);
      });
      return;
    }
    response.statusCode = mode === 'http-500' ? 500 : 200;
    response.setHeader('content-type', 'text/html; charset=utf-8');
    const wire = mode === 'invalid-shape'
      ? '{"plugins":["fake"]}'
      : mode === 'malformed-second'
        ? '{"rev":"fake-rev","entries":[{"id":"fake","url":"/plugins/fake/client.js?rev=fake","rev":"fake"},{"id":"broken","url":42,"rev":"broken"}]}'
        : '{"rev":"fake-rev","entries":[{"id":"fake","url":"/plugins/fake/client.js?rev=fake","rev":"fake","inject":[],"external":[],"immediately":true}]}';
    response.end('<!doctype html><script>globalThis["__DSH_BOOT__"] = ' + wire + '</script>');
  });
  server.listen(0, '127.0.0.1', () => {
    console.log('dsh web: http://127.0.0.1:' + server.address().port);
    if (mode === 'exit-before-readiness') setTimeout(() => process.exit(0), 50);
  });
}
`);

const envFor = () => ({
  ...process.env,
  NODE_OPTIONS: '--require=/definitely/not-present/dsh-movein-secret-probe.cjs',
  NODE_PATH: '/private/node-path',
  NODE_EXTRA_CA_CERTS: '/private/ca.pem',
  DATABASE_URL: 'postgres://private',
  PRIVATE_KEY: 'private-key',
  GH_PAT: 'github-token',
  JWT_SECRET: 'jwt-secret',
  COOKIE: 'session=private',
  FAKE_API_KEY: 'must-not-reach-child',
  AWS_SECRET_ACCESS_KEY: 'aws-secret',
  INNOCENT_BUT_PRIVATE: 'strict allowlist must remove arbitrary names too',
});
const reset = (mode = 'success') => {
  setMode(mode);
  fs.writeFileSync(marker, '');
  try { fs.unlinkSync(mcpMarker); } catch (error) { if (error.code !== 'ENOENT') throw error; }
};
const assertCapabilityStopped = () => {
  assert.strictEqual(fs.readFileSync(marker, 'utf8'), 'capability\n', 'capability failure must block active config dump and web boot');
  assert.ok(!fs.existsSync(mcpMarker), 'capability failure must never activate migrated config');
};
const liveSnapshotNames = () => new Set(fs.readdirSync(os.tmpdir()).filter((name) => (
  name.startsWith('dsh-movein-live-') && name !== path.basename(root)
)));
const runFakeDoctor = (options) => runLiveDoctor({ nodeVersion: '22.19.0', ...options });
const removePreservedSnapshots = (names) => {
  for (const name of names) {
    assert.match(name, /^dsh-movein-live-[A-Za-z0-9_-]+$/, 'only the test-created live snapshot may be removed');
    const snapshot = path.join(os.tmpdir(), name);
    const modules = path.join(snapshot, 'profiles', 'web', 'node_modules');
    if (fs.lstatSync(modules).isSymbolicLink()) fs.unlinkSync(modules);
    fs.rmSync(snapshot, { recursive: true, force: true });
  }
};

try {
  const help = execFileSync(process.execPath, [path.join(process.cwd(), 'bin', 'cli.mjs'), '--help'], { encoding: 'utf8' });
  assert.match(help, /--live\s+with doctor/);

  reset();
  const success = await runFakeDoctor({ dshHome: fakeHome, env: envFor(), timeoutMs: 2_000, shutdownTimeoutMs: 1_000 });
  assert.deepStrictEqual(success.map((check) => check.level), ['ok', 'ok', 'ok']);
  assert.match(success[0].note, /boot-free config-dump capability.*validated and discarded/);
  assert.match(success[1].note, /composed without activation.*validated and discarded/);
  assert.match(success[2].note, /official base\/web-only baseline.*valid __DSH_BOOT__.*JavaScript 200.*port was released/);
  assert.match(fs.readFileSync(marker, 'utf8'), /capability\ncomposed\nstarted\nasset fetched\nstopped/);
  assert.ok(!fs.existsSync(mcpMarker), 'active migrated MCP command must never execute');
  assert.doesNotMatch(JSON.stringify(success), /inline-secret-never-send/, 'captured composition output must never be reported');
  assert.strictEqual(fs.readFileSync(path.join(profile, 'cordis.yml'), 'utf8'), 'original profile root\n', 'live checks must not rewrite the source profile');
  assert.ok(fs.existsSync(path.join(profile, 'node_modules', 'probe-package', 'package.json')), 'snapshot cleanup must not traverse the source node_modules link');

  const missingHome = path.join(root, 'missing');
  fs.mkdirSync(missingHome);
  const missing = await runFakeDoctor({ dshHome: missingHome, timeoutMs: 100 });
  assert.strictEqual(missing[0].level, 'bad');
  assert.match(missing[0].note, /not installed.*no download attempted/);

  reset();
  setVersion('0.1.1-rc.1');
  const oldDsh = await runFakeDoctor({ dshHome: fakeHome, env: envFor(), timeoutMs: 100 });
  assert.strictEqual(oldDsh[0].level, 'bad');
  assert.match(oldDsh[0].note, /predates the known-safe 0\.1\.1-rc\.2.*child not started/);
  assert.strictEqual(fs.readFileSync(marker, 'utf8'), '', 'an old DSH version must be rejected before child spawn');
  setVersion('0.1.1-rc.2');

  reset();
  const unsupported = await runFakeDoctor({ dshHome: fakeHome, env: envFor(), nodeVersion: '23.6.0' });
  assert.strictEqual(unsupported[0].level, 'bad');
  assert.match(unsupported[0].note, /runtime unsupported on Node 23\.6\.0.*child not started/);
  assert.strictEqual(fs.readFileSync(marker, 'utf8'), '', 'unsupported Node must be rejected before child spawn');

  for (const [mode, expected] of [
    ['capability-fail', /exited with code 6/],
    ['capability-empty', /stdout was empty/],
    ['capability-no-signature', /expected # == section and YAML-list signature/],
    ['capability-overflow', /stdout exceeded 64 KiB/],
  ]) {
    reset(mode);
    const result = await runFakeDoctor({ dshHome: fakeHome, env: envFor(), timeoutMs: 1_000, shutdownTimeoutMs: 500 });
    assert.deepStrictEqual(result.map((check) => check.level), ['bad'], `${mode}: ${JSON.stringify(result)}`);
    assert.match(result[0].note, expected);
    assertCapabilityStopped();
  }

  reset('fail');
  const failed = await runFakeDoctor({ dshHome: fakeHome, env: envFor(), timeoutMs: 1_000, shutdownTimeoutMs: 500 });
  assert.strictEqual(failed.at(-1).level, 'bad');
  assert.match(failed.at(-1).note, /code 7.*fake startup failure/);

  for (const [mode, expected] of [
    ['composition-fail', /exited with code 6/],
    ['composition-empty', /stdout was empty/],
    ['composition-no-signature', /expected # == section and YAML-list signature/],
    ['composition-overflow', /stdout exceeded 64 KiB/],
  ]) {
    reset(mode);
    const result = await runFakeDoctor({ dshHome: fakeHome, env: envFor(), timeoutMs: 1_000, shutdownTimeoutMs: 500 });
    assert.deepStrictEqual(result.map((check) => check.level), ['ok', 'bad', 'ok']);
    assert.match(result[1].note, expected);
    assert.match(fs.readFileSync(marker, 'utf8'), /capability\ncomposed\nstarted\nasset fetched\nstopped/);
    assert.ok(!fs.existsSync(mcpMarker), 'an invalid active dump must still never activate migrated MCP');
  }

  reset('timeout');
  const timedOut = await runFakeDoctor({ dshHome: fakeHome, env: envFor(), timeoutMs: 150, shutdownTimeoutMs: 1_000 });
  assert.strictEqual(timedOut.at(-1).level, 'bad');
  assert.match(timedOut.at(-1).note, /timed out.*stopped cleanly/);
  assert.match(fs.readFileSync(marker, 'utf8'), /stopped/, 'timeout must terminate the child');

  reset('timeout');
  const controller = new AbortController();
  const abortPoll = setInterval(() => {
    if (fs.readFileSync(marker, 'utf8').includes('started')) {
      clearInterval(abortPoll);
      controller.abort('test signal');
    }
  }, 5);
  const interrupted = await runFakeDoctor({ dshHome: fakeHome, env: envFor(), timeoutMs: 2_000, shutdownTimeoutMs: 1_000, signal: controller.signal });
  clearInterval(abortPoll);
  assert.strictEqual(interrupted.at(-1).level, 'bad');
  assert.match(interrupted.at(-1).note, /interrupted by test signal.*stopped cleanly/);
  assert.match(fs.readFileSync(marker, 'utf8'), /stopped/, 'abort signal must terminate the child');

  reset('http-500');
  const httpFailure = await runFakeDoctor({ dshHome: fakeHome, env: envFor(), timeoutMs: 750, shutdownTimeoutMs: 1_000 });
  assert.strictEqual(httpFailure.at(-1).level, 'bad');
  assert.match(httpFailure.at(-1).note, /last HTTP 500/);
  assert.match(fs.readFileSync(marker, 'utf8'), /stopped/, 'failed readiness must terminate the child');

  reset('invalid-shape');
  const invalidShape = await runFakeDoctor({ dshHome: fakeHome, env: envFor(), timeoutMs: 750, shutdownTimeoutMs: 1_000 });
  assert.strictEqual(invalidShape.at(-1).level, 'bad');
  assert.match(invalidShape.at(-1).note, /invalid __DSH_BOOT__ wire shape/);

  reset('malformed-second');
  const malformedSecond = await runFakeDoctor({ dshHome: fakeHome, env: envFor(), timeoutMs: 750, shutdownTimeoutMs: 1_000 });
  assert.strictEqual(malformedSecond.at(-1).level, 'bad');
  assert.match(malformedSecond.at(-1).note, /invalid __DSH_BOOT__ wire shape/);
  assert.doesNotMatch(fs.readFileSync(marker, 'utf8'), /asset fetched/, 'one valid row must not hide a malformed second wire row');

  for (const mode of ['exit-after-readiness', 'exit-before-readiness']) {
    reset(mode);
    const snapshotsBefore = liveSnapshotNames();
    let pageCalls = 0;
    const stickyPage = async (url) => {
      pageCalls += 1;
      if (mode === 'exit-after-readiness' && pageCalls === 1) {
        return {
          reachable: true,
          status: 200,
          contentType: 'text/html; charset=utf-8',
          validBoot: true,
          assetUrl: new URL('/plugins/fake/client.js', url),
          ready: true,
        };
      }
      if (mode === 'exit-before-readiness' && pageCalls === 1) {
        return new Promise((resolve) => setTimeout(() => resolve({ reachable: true, ready: false, status: 503 }), 200));
      }
      return { reachable: true, ready: false, status: 200 };
    };
    const exited = await runFakeDoctor({
      dshHome: fakeHome,
      env: envFor(),
      timeoutMs: 1_000,
      shutdownTimeoutMs: 500,
      pageRequest: stickyPage,
    });
    const snapshotsAfter = liveSnapshotNames();
    const preserved = [...snapshotsAfter].filter((name) => !snapshotsBefore.has(name));
    try {
      assert.ok(exited.some((check) => check.label === 'live DSH web baseline' && check.level === 'bad' && /exited/.test(check.note)), `${mode}: ${JSON.stringify(exited)}`);
      assert.ok(exited.some((check) => check.label === 'live DSH cleanup' && /loopback port remained reachable.*snapshot preserved/.test(check.note)));
      assert.ok(pageCalls >= 2, 'the port must be re-probed after observing direct-child exit');
      assert.strictEqual(preserved.length, 1, 'unconfirmed port cleanup must preserve exactly the active disposable snapshot');
    } finally {
      removePreservedSnapshots(preserved);
    }
  }

  reset('stubborn');
  const forced = await runFakeDoctor({ dshHome: fakeHome, env: envFor(), timeoutMs: 500, shutdownTimeoutMs: 100 });
  assert.strictEqual(forced.at(-1).level, 'bad');
  assert.match(forced.at(-1).note, /required forced cleanup/);

  reset();
  const windows = await runFakeDoctor({
    dshHome: fakeHome,
    env: envFor(),
    timeoutMs: 1_000,
    shutdownTimeoutMs: 1_000,
    platform: 'win32',
  });
  assert.deepStrictEqual(windows.map((check) => check.level), ['ok', 'ok', 'ok']);
  assert.match(windows[2].note, /child exited and the loopback port was released/);
  assert.match(fs.readFileSync(marker, 'utf8'), /stopped/, 'Windows cleanup uses the retained child handle and observes exit');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log('doctor live tests passed');
