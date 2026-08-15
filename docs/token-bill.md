# The token bill of your skill catalog in DSH

Every DSH request that can see skills carries a `<system-reminder>` catalog block, one line per skill. This measures exactly what that costs, reconstructed byte for byte from the DSH source at `0.1.0-rc.6` (`packages/skill/tool-skill/src/index.ts`, `renderCatalog`). Reproduce it yourself: `node scripts/token-bill.mjs` in this repo.

实测 DSH 技能目录在每个请求里占多少 token，格式逐字取自源码，可复现。中文摘要在文末。

## Numbers

| skills in catalog | tokens per request | marginal cost per skill |
|---|---|---|
| 0 | 143 | |
| 5 | 283 | ~28 |
| 20 | 703 | ~28 |
| 40 | 1,263 | ~28 |
| 80 | 2,383 | ~28 |
| 129 | 3,755 | ~28 |

- Fixed framing costs **143 tokens**, each skill adds **~28 tokens** (for a median-shaped 96-character description, your bill scales with your description lengths).
- 129 is not a random number, it is the plugin count from the orange-book boot log. A setup that size pays **~3.8k tokens of catalog on every request**.
- Workspace instructions (`AGENTS.md`/`CLAUDE.md`) add their own block, 50 tokens of framing plus your full file content, budget capped at 64KB.
- Tokenizer is o200k_base as an approximation (the DeepSeek tokenizer is not published for JS). Relative shape is what matters.

## Why this matters if you migrate

`dsh-movein` will happily move every Claude Code skill you have, and each one you bring costs ~28 tokens per request forever after. Prompt caching softens the money (cache-hit input is cheap) but not the context window, the catalog occupies it on every request either way.

Practical take, **curate before you migrate**. Move the skills you use, not the skills you have. Skills are symlinked, so trimming later is deleting one link. And keep descriptions tight, the description IS the per-request cost.

This is also the block the interesting preset experiments (anchored standard bootstraps) suppress on the first request, now you know how many tokens that suppression is actually worth for your setup.

## 中文摘要

- 技能目录的固定包装 143 token，每个技能约 28 token（按 96 字符描述计，实际随描述长度变化），129 个技能的配置每个请求背 ~3.8k token。
- Prompt 缓存能省钱，省不了上下文窗口。
- 结论：搬家前先精简，搬你用的技能，不是你有的技能。技能是符号链接，之后删掉一个 link 就行。描述写短点，描述就是每请求的账单。
- 复现：仓库里 `node scripts/token-bill.mjs`，格式逐字取自 rc.6 源码，分词器用 o200k 近似（DeepSeek 分词器无 JS 版）。
