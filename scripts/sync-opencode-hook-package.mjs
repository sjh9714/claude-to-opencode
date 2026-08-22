import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderOpenCodeHookPlugin } from '../lib/opencode-hook-plugin.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const target = path.join(root, 'packages', 'opencode-claude-code-hooks', 'index.js');
fs.writeFileSync(target, `${renderOpenCodeHookPlugin().trimEnd()}\n`);
