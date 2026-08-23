import fs from 'node:fs';
import path from 'node:path';

const MARKER = '.dsh-movein-star-prompted';

export function claimStarPrompt(dshHome, actions) {
  if (!actions.some((action) => action.status === 'done')) return false;
  if (actions.some((action) => action.status === 'error')) return false;
  const marker = path.join(dshHome, MARKER);
  if (fs.existsSync(marker)) return false;
  try {
    fs.mkdirSync(dshHome, { recursive: true });
    fs.writeFileSync(marker, `${new Date().toISOString()}\n`, { flag: 'wx' });
    return true;
  } catch (error) {
    if (error?.code === 'EEXIST') return false;
    return false;
  }
}
