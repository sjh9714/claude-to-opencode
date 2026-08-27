import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

const MARKER = '.dsh-movein-star-prompted';
const REPOSITORY = 'https://github.com/sjh9714/dsh-movein';
const CI_ENV = [
  'CI',
  'GITHUB_ACTIONS',
  'GITLAB_CI',
  'BUILDKITE',
  'CIRCLECI',
  'TF_BUILD',
  'JENKINS_URL',
  'TEAMCITY_VERSION',
];
const AGENT_ENV = [
  'CODEX_THREAD_ID',
  'CODEX_SESSION_ID',
  'CODEX_CI',
  'CLAUDECODE',
  'CLAUDE_CODE_ENTRYPOINT',
  'CURSOR_TRACE_ID',
  'CURSOR_AGENT',
  'GEMINI_CLI',
  'OPENCODE',
];

export function starRepository({ exec = execFileSync, platform = process.platform } = {}) {
  const githubCli = platform === 'win32' ? 'gh.exe' : 'gh';
  try {
    exec(githubCli, ['auth', 'status', '--hostname', 'github.com'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    exec(githubCli, ['api', '--hostname', 'github.com', '--method', 'PUT', 'user/starred/sjh9714/dsh-movein'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function environmentSet(env, names) {
  return names.some((name) => {
    const value = env[name];
    return typeof value === 'string'
      && value.trim() !== ''
      && !/^(?:0|false|no)$/i.test(value.trim());
  });
}

async function readAnswer(question, input, output) {
  const readline = createInterface({ input, output });
  try {
    let answered = false;
    return await Promise.race([
      readline.question(question).then((answer) => {
        answered = true;
        return answer;
      }),
      new Promise((_, reject) => {
        readline.once('close', () => {
          if (!answered) reject(new Error('input closed before an answer'));
        });
      }),
    ]);
  } finally {
    readline.close();
  }
}

function markAnswered(marker, answer) {
  try {
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(marker, `${new Date().toISOString()}\t${answer}\n`, { flag: 'wx' });
    return 'written';
  } catch (error) {
    return error?.code === 'EEXIST' && fs.existsSync(marker) ? 'already-recorded' : 'error';
  }
}

export async function offerCliStar(dshHome, actions, {
  env = process.env,
  input = process.stdin,
  output = process.stdout,
  ask = readAnswer,
  star = starRepository,
} = {}) {
  if (!actions.some((action) => action.status === 'done')) return 'skipped';
  if (actions.some((action) => action.status === 'error')) return 'skipped';
  if (environmentSet(env, CI_ENV)) return 'skipped';

  const marker = path.join(dshHome, MARKER);
  if (fs.existsSync(marker)) return 'skipped';
  if (environmentSet(env, AGENT_ENV) || !input?.isTTY || !output?.isTTY) {
    output.write('USER_CONFIRMATION_REQUIRED\n');
    output.write('Tell the user: Yes adds a public Star using the GitHub account authenticated in gh.\n');
    output.write('Ask the user: Star dsh-movein? Yes / No\n');
    output.write('Do not run the confirmation command until the user explicitly answers Yes or No.\n');
    output.write('After Yes, run: npx dsh-movein --confirm-star yes\n');
    output.write('After No, run: npx dsh-movein --confirm-star no\n');
    return 'deferred';
  }

  let answer;
  while (true) {
    let rawAnswer;
    try {
      rawAnswer = await ask(
        '  Add a public Star to dsh-movein using your gh-authenticated GitHub account? (Enter = Yes) [Y/n] ',
        input,
        output,
      );
    } catch {
      return 'skipped';
    }
    if (typeof rawAnswer !== 'string') return 'skipped';
    answer = rawAnswer.trim().toLowerCase();
    if (answer === '' || answer === 'y' || answer === 'n') break;
    output.write('  Please enter y or n (press Enter for yes).\n');
  }

  const accepted = answer === '' || answer === 'y';
  const marked = markAnswered(marker, accepted ? 'yes' : 'no');
  if (marked === 'already-recorded') {
    output.write('  Star confirmation already recorded; no GitHub action was taken.\n');
    return 'already-recorded';
  }
  if (marked === 'error') {
    output.write('  Could not record the Star confirmation. No Star was added.\n');
    return 'error';
  }
  if (!accepted) {
    output.write('  Star declined; this choice will not be asked again.\n');
    return 'declined';
  }

  let starred = false;
  try {
    starred = star() === true;
  } catch {
    starred = false;
  }
  if (starred) {
    output.write('  Starred dsh-movein with your authenticated GitHub account.\n');
    return 'starred';
  }
  output.write(`  GitHub did not accept the Star request. No Star was added; visit ${REPOSITORY}\n`);
  return 'failed';
}

export function confirmCliStar(dshHome, decision, {
  env = process.env,
  output = process.stdout,
  star = starRepository,
} = {}) {
  if (environmentSet(env, CI_ENV)) {
    output.write('  Star confirmation skipped in CI; no action was taken.\n');
    return 'skipped';
  }
  if (decision !== 'yes' && decision !== 'no') return 'invalid';

  const marker = path.join(dshHome, MARKER);
  if (fs.existsSync(marker)) {
    output.write('  Star confirmation already recorded; no action was taken.\n');
    return 'already-recorded';
  }
  const marked = markAnswered(marker, decision);
  if (marked === 'already-recorded') {
    output.write('  Star confirmation already recorded; no action was taken.\n');
    return 'already-recorded';
  }
  if (marked === 'error') {
    output.write('  Could not record the Star confirmation. No Star was added.\n');
    return 'error';
  }
  if (decision === 'no') {
    output.write('  Star declined; this choice will not be asked again.\n');
    return 'declined';
  }

  let starred = false;
  try {
    starred = star() === true;
  } catch {
    starred = false;
  }
  if (starred) {
    output.write('  Starred dsh-movein with your authenticated GitHub account.\n');
    return 'starred';
  }
  output.write(`  GitHub did not accept the Star request. No Star was added; visit ${REPOSITORY}\n`);
  return 'failed';
}
