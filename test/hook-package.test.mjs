import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderOpenCodeHookPlugin } from '../lib/opencode-hook-plugin.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const packageRoot = path.join(root, 'packages', 'opencode-claude-code-hooks');
const entry = path.join(packageRoot, 'index.js');
const source = fs.readFileSync(entry, 'utf8');

assert.strictEqual(source, `${renderOpenCodeHookPlugin().trimEnd()}\n`, 'npm plugin stays identical to the generated local plugin');

const plugin = await import(`${pathToFileURL(entry).href}?test=${Date.now()}`);
assert.strictEqual(typeof plugin.ClaudeCodeHooks, 'function');

const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
assert.strictEqual(pkg.name, 'opencode-claude-code-hooks');
assert.strictEqual(pkg.version, '0.1.0');

console.log('opencode hook package assertions passed');
