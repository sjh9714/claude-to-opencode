// Reconstructs the exact model-facing text DSH injects for a skill catalog of
// size N and prints its token cost. Formats are lifted verbatim from the DSH
// source (packages/skill/tool-skill/src/index.ts renderCatalog,
// packages/context/agent-instructions/src/render.ts intro), pinned at
// 0.1.0-rc.6. Tokenizer: o200k_base as an approximation, the DeepSeek
// tokenizer is not published for JS; relative comparisons are what matter.
//
// Usage: node scripts/token-bill.mjs [--tokenizer-dir <dir-with-gpt-tokenizer>]
import { createRequire } from 'node:module';

const dirFlag = process.argv.indexOf('--tokenizer-dir');
const tokDir = dirFlag > -1 ? process.argv[dirFlag + 1] : process.cwd();
const require = createRequire(tokDir.endsWith('/') ? tokDir + 'x.js' : tokDir + '/x.js');
const { encode } = require('gpt-tokenizer/encoding/o200k_base');

const CATALOG_INTRO = [
  '<system-reminder>',
  'A skill is a reusable set of task-specific instructions. The following skills are available in this session:',
  '',
  '<available_skills>',
].join('\n');
const CATALOG_OUTRO = [
  '</available_skills>',
  '',
  "If the user names a skill, or the task clearly matches a skill's description, call the `skill` tool with the exact skill name before taking task actions. Load all applicable skills, then follow their full instructions. This catalog contains summaries only; do not infer or follow a skill's instructions until it has been loaded.",
  'A user may also invoke a skill directly; its <skill_content> block then appears in this conversation. Follow it, and do not call the `skill` tool again for that skill.',
  '</system-reminder>',
].join('\n');

// Median-shaped synthetic entry, name 18 chars, description 96 chars, matching
// the shape of real SKILL.md descriptions sampled from public dsh-plugin repos.
const entry = (i) =>
  `- \`sample-skill-${String(i).padStart(3, '0')}\`: Use when the task calls for scenario ${i}, covers scanning, converting and verifying the target assets.`;

const catalogText = (n) =>
  [CATALOG_INTRO, ...Array.from({ length: n }, (_, i) => entry(i)), CATALOG_OUTRO].join('\n');

console.log('DSH skill-catalog system-reminder, tokens by catalog size (o200k approx):');
console.log('| skills | tokens | tokens/skill (marginal) |');
console.log('|---|---|---|');
let prev = null;
for (const n of [0, 5, 10, 20, 40, 80, 129]) {
  const t = encode(catalogText(n)).length;
  const marginal = prev === null ? '' : ((t - prev.t) / (n - prev.n)).toFixed(1);
  console.log(`| ${n} | ${t} | ${marginal} |`);
  prev = { n, t };
}

const INSTR_INTRO = '<system-reminder>\n'
  + 'The following workspace instructions may be relevant to your work. '
  + 'Use them as guidance when applicable. More specific instructions take precedence over broader ones. '
  + 'They do not override system, developer, or direct user instructions.';
console.log('');
console.log(`Workspace-instructions framing alone: ${encode(INSTR_INTRO + '\n</system-reminder>').length} tokens + your CLAUDE.md/AGENTS.md content (budget cap 65536 bytes).`);
