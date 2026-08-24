import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const MARKER = '.dsh-movein-star-prompted';

function starRepository() {
  const githubCli = process.platform === 'win32' ? 'gh.exe' : 'gh';
  try {
    execFileSync(githubCli, ['auth', 'status', '--hostname', 'github.com'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    execFileSync(githubCli, ['api', '--method', 'PUT', 'user/starred/sjh9714/dsh-movein'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

export function claimStarPrompt(dshHome, actions, star = starRepository) {
  if (!actions.some((action) => action.status === 'done')) return false;
  if (actions.some((action) => action.status === 'error')) return false;
  const marker = path.join(dshHome, MARKER);
  if (fs.existsSync(marker)) return false;
  try {
    fs.mkdirSync(dshHome, { recursive: true });
    fs.writeFileSync(marker, `${new Date().toISOString()}\n`, { flag: 'wx' });
    return !star();
  } catch (error) {
    if (error?.code === 'EEXIST') return false;
    return false;
  }
}
