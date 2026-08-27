import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { confirmCliStar, offerCliStar, starRepository } from '../lib/star.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-movein-star-'));
const done = [{ status: 'done' }];
const ttyIn = { isTTY: true };
const outputText = [];
const ttyOut = { isTTY: true, write: (text) => outputText.push(String(text)) };

const ghCalls = [];
assert.strictEqual(starRepository({
  platform: 'linux',
  exec: (file, args) => ghCalls.push({ file, args }),
}), true);
assert.deepStrictEqual(ghCalls[0], {
  file: 'gh',
  args: ['auth', 'status', '--hostname', 'github.com'],
});
assert.deepStrictEqual(ghCalls[1], {
  file: 'gh',
  args: ['api', '--hostname', 'github.com', '--method', 'PUT', 'user/starred/sjh9714/dsh-movein'],
});

async function run(name, answer, options = {}) {
  const home = path.join(tmp, name);
  const answers = Array.isArray(answer) ? [...answer] : [answer];
  let asks = 0;
  let stars = 0;
  const result = await offerCliStar(home, done, {
    env: {},
    input: ttyIn,
    output: ttyOut,
    ask: async (question) => {
      asks += 1;
      assert.match(question, /public Star/);
      assert.match(question, /gh-authenticated GitHub account/);
      assert.match(question, /Enter = Yes/);
      assert.match(question, /\[Y\/n\]/);
      const next = answers.shift();
      if (next instanceof Error) throw next;
      return next;
    },
    star: () => { stars += 1; return options.starResult ?? true; },
    ...options,
  });
  return { home, result, asks, stars };
}

const entered = await run('enter', '');
assert.strictEqual(entered.result, 'starred');
assert.strictEqual(entered.stars, 1);
assert.match(fs.readFileSync(path.join(entered.home, '.dsh-movein-star-prompted'), 'utf8'), /\tyes\n$/);

const yes = await run('yes', 'Y');
assert.strictEqual(yes.result, 'starred');
assert.strictEqual(yes.stars, 1);

const noOutput = [];
const no = await run('no', 'N', {
  output: { isTTY: true, write: (text) => noOutput.push(String(text)) },
});
assert.strictEqual(no.result, 'declined');
assert.strictEqual(no.stars, 0);
assert.match(noOutput.join(''), /Star declined; this choice will not be asked again/);
assert.match(fs.readFileSync(path.join(no.home, '.dsh-movein-star-prompted'), 'utf8'), /\tno\n$/);
const noAgain = await offerCliStar(no.home, done, {
  env: {}, input: ttyIn, output: ttyOut,
  ask: async () => { throw new Error('must not ask twice'); },
  star: () => { throw new Error('must not star twice'); },
});
assert.strictEqual(noAgain, 'skipped');

const eof = await run('eof', new Error('EOF'));
assert.strictEqual(eof.result, 'skipped');
assert.strictEqual(eof.stars, 0);
assert.ok(!fs.existsSync(path.join(eof.home, '.dsh-movein-star-prompted')));

const realEofHome = path.join(tmp, 'real-eof');
const eofInput = new PassThrough();
eofInput.isTTY = true;
const eofOutput = new PassThrough();
eofOutput.isTTY = true;
let realEofStars = 0;
let eofTimeout;
setImmediate(() => eofInput.end());
const realEof = await Promise.race([
  offerCliStar(realEofHome, done, {
    env: {}, input: eofInput, output: eofOutput,
    star: () => { realEofStars += 1; return true; },
  }),
  new Promise((resolve) => { eofTimeout = setTimeout(() => resolve('timeout'), 1_000); }),
]);
clearTimeout(eofTimeout);
assert.strictEqual(realEof, 'skipped', 'a real EOF must settle fail-closed instead of hanging');
assert.strictEqual(realEofStars, 0);
assert.ok(!fs.existsSync(path.join(realEofHome, '.dsh-movein-star-prompted')));

const retryOutput = [];
const invalid = await run('invalid', ['yes', 'N'], {
  output: { isTTY: true, write: (text) => retryOutput.push(String(text)) },
});
assert.strictEqual(invalid.result, 'declined');
assert.strictEqual(invalid.asks, 2);
assert.strictEqual(invalid.stars, 0);
assert.match(retryOutput.join(''), /Please enter y or n \(press Enter for yes\)/);
assert.match(fs.readFileSync(path.join(invalid.home, '.dsh-movein-star-prompted'), 'utf8'), /\tno\n$/);

const invalidEof = await run('invalid-eof', ['maybe', new Error('EOF')]);
assert.strictEqual(invalidEof.result, 'skipped');
assert.strictEqual(invalidEof.asks, 2);
assert.strictEqual(invalidEof.stars, 0);
assert.ok(!fs.existsSync(path.join(invalidEof.home, '.dsh-movein-star-prompted')));

for (const variable of ['CODEX_THREAD_ID', 'CODEX_SESSION_ID', 'CODEX_CI', 'CLAUDECODE', 'CURSOR_TRACE_ID', 'GEMINI_CLI']) {
  const agentOutput = [];
  const automated = await run(`agent-${variable}`, '', {
    env: { [variable]: '1' },
    output: { isTTY: true, write: (text) => agentOutput.push(String(text)) },
  });
  assert.strictEqual(automated.result, 'deferred');
  assert.strictEqual(automated.asks, 0);
  assert.strictEqual(automated.stars, 0);
  assert.ok(!fs.existsSync(path.join(automated.home, '.dsh-movein-star-prompted')));
  assert.match(agentOutput.join(''), /USER_CONFIRMATION_REQUIRED/);
  assert.match(agentOutput.join(''), /Yes adds a public Star using the GitHub account authenticated in gh/);
  assert.match(agentOutput.join(''), /Ask the user: Star dsh-movein\? Yes \/ No/);
  assert.match(agentOutput.join(''), /Do not run the confirmation command until the user explicitly answers Yes or No\./);
  assert.match(agentOutput.join(''), /--confirm-star yes/);
  assert.match(agentOutput.join(''), /--confirm-star no/);
}

for (const variable of ['CI', 'GITHUB_ACTIONS', 'CIRCLECI', 'TEAMCITY_VERSION']) {
  const ci = await run(`ci-${variable}`, '', { env: { [variable]: '1' } });
  assert.strictEqual(ci.result, 'skipped');
  assert.strictEqual(ci.asks, 0);
  assert.strictEqual(ci.stars, 0);
  assert.ok(!fs.existsSync(path.join(ci.home, '.dsh-movein-star-prompted')));
}

const nonTtyOutput = [];
const nonTty = await run('non-tty', '', {
  input: { isTTY: false },
  output: { isTTY: false, write: (text) => nonTtyOutput.push(String(text)) },
});
assert.strictEqual(nonTty.result, 'deferred');
assert.strictEqual(nonTty.asks, 0);
assert.strictEqual(nonTty.stars, 0);
assert.ok(!fs.existsSync(path.join(nonTty.home, '.dsh-movein-star-prompted')));
assert.match(nonTtyOutput.join(''), /USER_CONFIRMATION_REQUIRED/);

const failed = await run('failed', '', { starResult: false });
assert.strictEqual(failed.result, 'failed');
assert.strictEqual(failed.stars, 1);
assert.ok(fs.existsSync(path.join(failed.home, '.dsh-movein-star-prompted')), 'a valid human answer is remembered even when gh fails');

const offerBlockedHome = path.join(tmp, 'offer-write-error');
fs.writeFileSync(offerBlockedHome, 'not a directory');
const offerBlockedOutput = [];
assert.strictEqual(await offerCliStar(offerBlockedHome, done, {
  env: {}, input: ttyIn,
  output: { isTTY: true, write: (text) => offerBlockedOutput.push(String(text)) },
  ask: async () => 'y',
  star: () => { throw new Error('A marker failure must not call the Star API'); },
}), 'error');
assert.match(offerBlockedOutput.join(''), /Could not record the Star confirmation\. No Star was added\./);

const offerRaceHome = path.join(tmp, 'offer-race');
const offerRaceMarker = path.join(offerRaceHome, '.dsh-movein-star-prompted');
const offerRaceOutput = [];
assert.strictEqual(await offerCliStar(offerRaceHome, done, {
  env: {}, input: ttyIn,
  output: { isTTY: true, write: (text) => offerRaceOutput.push(String(text)) },
  ask: async () => {
    fs.mkdirSync(offerRaceHome, { recursive: true });
    fs.writeFileSync(offerRaceMarker, 'concurrent answer\n');
    return 'y';
  },
  star: () => { throw new Error('A concurrent answer must not call the Star API'); },
}), 'already-recorded');
assert.match(offerRaceOutput.join(''), /already recorded; no GitHub action was taken/);

const actionError = await offerCliStar(path.join(tmp, 'action-error'), [{ status: 'done' }, { status: 'error' }], {
  env: {}, input: ttyIn, output: ttyOut,
  ask: async () => { throw new Error('must not ask after failed apply'); },
});
assert.strictEqual(actionError, 'skipped');

let confirmedStars = 0;
const confirmYesHome = path.join(tmp, 'confirm-yes');
assert.strictEqual(confirmCliStar(confirmYesHome, 'yes', {
  env: { CODEX_THREAD_ID: 'thread' }, output: ttyOut,
  star: () => { confirmedStars += 1; return true; },
}), 'starred');
assert.strictEqual(confirmedStars, 1);
assert.match(fs.readFileSync(path.join(confirmYesHome, '.dsh-movein-star-prompted'), 'utf8'), /\tyes\n$/);
const alreadyOutput = [];
assert.strictEqual(confirmCliStar(confirmYesHome, 'yes', {
  env: {}, output: { write: (text) => alreadyOutput.push(String(text)) },
  star: () => { throw new Error('A recorded answer must not call the Star API again'); },
}), 'already-recorded');
assert.match(alreadyOutput.join(''), /already recorded; no action was taken/);

const confirmNoHome = path.join(tmp, 'confirm-no');
assert.strictEqual(confirmCliStar(confirmNoHome, 'no', {
  env: { CLAUDECODE: '1' }, output: ttyOut,
  star: () => { throw new Error('No must never call the Star API'); },
}), 'declined');
assert.match(fs.readFileSync(path.join(confirmNoHome, '.dsh-movein-star-prompted'), 'utf8'), /\tno\n$/);

const confirmCiHome = path.join(tmp, 'confirm-ci');
const ciOutput = [];
assert.strictEqual(confirmCliStar(confirmCiHome, 'yes', {
  env: { CI: 'true' }, output: { write: (text) => ciOutput.push(String(text)) },
  star: () => { throw new Error('CI must never call the Star API'); },
}), 'skipped');
assert.ok(!fs.existsSync(path.join(confirmCiHome, '.dsh-movein-star-prompted')));
assert.match(ciOutput.join(''), /skipped in CI; no action was taken/);

const blockedHome = path.join(tmp, 'confirm-write-error');
fs.writeFileSync(blockedHome, 'not a directory');
const blockedOutput = [];
assert.strictEqual(confirmCliStar(blockedHome, 'yes', {
  env: {}, output: { write: (text) => blockedOutput.push(String(text)) },
  star: () => { throw new Error('A marker failure must not call the Star API'); },
}), 'error');
assert.match(blockedOutput.join(''), /Could not record the Star confirmation\. No Star was added\./);

const confirmInvalidHome = path.join(tmp, 'confirm-invalid');
assert.strictEqual(confirmCliStar(confirmInvalidHome, 'y', {
  env: {}, output: ttyOut,
  star: () => { throw new Error('Invalid confirmation must never call the Star API'); },
}), 'invalid');
assert.ok(!fs.existsSync(path.join(confirmInvalidHome, '.dsh-movein-star-prompted')));

const cli = fileURLToPath(new URL('../bin/cli.mjs', import.meta.url));
const cliWriteError = spawnSync(process.execPath, [cli, '--confirm-star', 'yes'], {
  env: { ...process.env, CI: '', DSH_HOME: blockedHome },
  encoding: 'utf8',
});
assert.strictEqual(cliWriteError.status, 1, 'marker write failure exits nonzero');
assert.match(cliWriteError.stdout, /Could not record the Star confirmation/);

const cliAlready = spawnSync(process.execPath, [cli, '--confirm-star', 'no'], {
  env: { ...process.env, CI: '', DSH_HOME: confirmNoHome },
  encoding: 'utf8',
});
assert.strictEqual(cliAlready.status, 0);
assert.match(cliAlready.stdout, /already recorded; no action was taken/);

assert.match(outputText.join(''), /Starred dsh-movein/);
assert.match(outputText.join(''), /No Star was added/);

console.log('star consent tests passed');
