import { build } from 'esbuild';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Script } from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));

await mkdir(join(ROOT, 'lib'), { recursive: true });
await build({
  entryPoints: [join(ROOT, 'src', 'client', 'index.jsx')],
  outfile: join(ROOT, 'lib', '_client.js'),
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  bundle: true,
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', '@deepseek-ai/*'],
  sourcemap: false,
});

const clientSource = await readFile(join(ROOT, 'lib', '_client.js'), 'utf8');
await rm(join(ROOT, 'lib', '_client.js'));
const bundle = [
  `/* ${pkg.name} client bundle */`,
  'window.__ModuleLoader__.load({',
  `  id: ${JSON.stringify(pkg.name)},`,
  '  factory: (require) => {',
  '    var module = { exports: {} };',
  '    var exports = module.exports;',
  clientSource.replace(/\s+$/, '\n'),
  '    return module.exports;',
  '  },',
  '});',
  '',
].join('\n');
await writeFile(join(ROOT, 'lib', 'client.js'), bundle);

new Script(bundle);
if (!bundle.includes('window.__ModuleLoader__.load(')) throw new Error('client bundle does not register');
const host = await import(pathToFileURL(join(ROOT, 'shell', 'index.mjs')).href);
if (host.name !== pkg.name || typeof host.apply !== 'function') throw new Error('host entry contract failed');
console.log(`built ${pkg.name} client`);
