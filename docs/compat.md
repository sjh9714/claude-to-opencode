# Claude Code, Codex, and OpenCode to DeepSeek Harness

This matrix records what `dsh-movein` moves, what DSH already reads, and what remains manual. The DSH behavior was measured against `0.1.0-rc.6` and rechecked end to end on `0.1.0-rc.7`.

一份实测的 Claude Code 与 DeepSeek Harness 资产兼容性对照表，基于 DSH `0.1.0-rc.6` 源码逐项验证。中文摘要在文末。

## Origin overview

| Origin | Instructions | Skills and commands | MCP | Other behavior |
| --- | --- | --- | --- | --- |
| Claude Code | Project native, global linked | Skills linked, commands and subagents converted | stdio and HTTP | Supported hooks and mapped deny or ask rules |
| Codex | Global `AGENTS.md` linked | Prompts converted | stdio | Approval and sandbox policy remain with DSH |
| OpenCode | Project `AGENTS.md` native, one global file linked | Skills linked, commands and agents converted | local and remote | Permissions and plugins remain manual |

## OpenCode compatibility

OpenCode paths and precedence follow the official [V2 configuration documentation](https://opencode.ai/v2/docs/config) and [V1 migration guide](https://opencode.ai/v2/docs/migrate-v1). JSONC parsing uses comments and trailing commas exactly as OpenCode permits.

| OpenCode asset | DSH compatibility | What happens |
| --- | --- | --- |
| Global config | **Read and merged** | `~/.config/opencode/opencode.json` and `opencode.jsonc` load first |
| Custom config | **Read and merged** | `OPENCODE_CONFIG` loads after global config |
| Project config | **Read and merged** | Direct configs load from the nearest Git root toward the current directory after custom config |
| `.opencode` config | **Read and merged** | These configs load from the Git root toward the current directory after every direct project config |
| Custom directory | **Read and merged** | `OPENCODE_CONFIG_DIR` contributes config and file-based assets before project definitions |
| Project `AGENTS.md` | **Native, zero work** | DSH already reads the same file |
| One global instruction file | **One symlink** | Linked to `$DSH_HOME/AGENTS.md` only when the destination is free |
| Multiple, globbed, or remote instructions | **Manual** | Reported without concatenation or network fetching |
| Skill directories | **Format compatible** | Both `skill` and `skills` aliases are found and linked into DSH roots |
| Agent files and inline agents | **Converted** | V1 `prompt`, V2 `system`, and the description become a DSH skill |
| Command files and inline commands | **Converted** | Template and description become a user-invocable DSH skill |
| Local MCP | **Mechanical conversion** | V1 direct maps and V2 `mcp.servers` maps become stdio command and args while string environment values remain intact |
| Remote MCP | **Mechanical conversion** | V1 direct maps and V2 `mcp.servers` maps become streamable HTTP rows |
| Disabled or malformed MCP | **Skipped visibly** | No row is written and the dry run names the skipped server |
| `{env:VAR}` | **Runtime reference** | Converted to `process.env.VAR` without reading the current value |
| `{file:path}` | **Preserved for review** | The placeholder remains visible and no file is read |
| Permissions and plugins | **Manual** | Reported as unsupported because DSH semantics differ |
| Sessions | **Out of scope** | No OpenCode session files are read or written |
| Invalid JSONC | **Apply blocked** | A parse error makes the complete apply operation write nothing |

## Claude Code compatibility

| Claude Code asset | DSH compatibility | What actually happens |
|---|---|---|
| Project `CLAUDE.md` | **Native, zero work** | `instructionFileCandidates` defaults to `['AGENTS.md', 'CLAUDE.md']`, local variants too. DSH discovers it from project root down to cwd and renders it the same system-reminder way Claude Code does |
| Global `~/.claude/CLAUDE.md` | **One symlink** | The global slot is `$DSH_HOME/AGENTS.md` only, no CLAUDE.md fallback there. Link it and you are done |
| Skills (`SKILL.md`) | **Format compatible as is** | Frontmatter parses as an open object, only `name` and `description` are required, unknown keys (`allowed-tools`, `license`, ...) are ignored. But `.claude/skills` is NOT one of the roots, so skills have to land in one (see the table below) |
| Slash-invoking skills | **Same UX** | Users type `/name`, the model loads via a skill tool, same shape both sides |
| MCP servers (`.mcp.json`) | **Lossless mechanical conversion** | One `dsh-mcp-client` config row per server (stdio and streamable-http). Tool names are literally identical, `mcp__server__tool` on both sides, so nothing referencing them breaks |
| Hooks (`settings.json` `hooks`) | **First party bridge, partial events** | `@deepseek-ai/dsh-hooks-claude-code` runs your existing hooks config unchanged, same stdin payload, exit code and matcher semantics, `${CLAUDE_PROJECT_DIR}` substituted. 7 of 30 events mapped (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop, SubagentStart, SubagentStop), the rest silently skipped. Command hooks only. Known upstream bug, matchers are case sensitive against DSH tool names, a `Bash` matcher does not select the lowercase `bash` tool so security hooks can fail silently (deepseek-harness discussion #582), write matchers lowercase until fixed |
| Permission rules | **Not native, bridgeable** | DSH has three coarse presets and no per tool allowlist. `deny`/`ask` rules can be enforced at the `tools/pre-execute` gate ([dsh-movein-permissions](../plugin/)), `allow` rules have no equivalent, the DSH preset governs the default |
| Subagents (`.claude/agents/*.md`) | **No direct import** | DSH agent presets are directories with `agent.cordis.yml`, not markdown. The practical path is converting agent definitions to skills (frontmatter is nearly identical). Fun fact, DSH ships a `subagent-claude-code` provider that literally spawns `claude` as a child agent |
| Slash commands (`.claude/commands/*.md`) | **No file equivalent** | DSH commands are code-registered. User-invocable skills are the file-based substitute |
| Sessions | **Hardest, avoid writing** | `~/.dsh/sessions` uses zstd-framed JSONL at `SESSION_FORMAT_VERSION = 0` with an explicit no-compatibility promise and strict event invariants. Import history as plugin-sourced recall messages, never by writing session files. For conversation history use [dsh-chat-import](https://github.com/Nwflower/dsh-chat-import) |
| Memory / `~/.claude` misc | **Manual** | No DSH counterpart, carry what matters into `AGENTS.md` or skills |

## Where DSH actually looks for skills

`.claude/skills` is not scanned, but there are six roots, not two. Read in rank order from `packages/skill/skill-filesystem/src/index.ts`, the first match wins on a name collision.

| Rank | Source | Root |
|---|---|---|
| 100 | `project-dsh` | `<projectRoot>/.dsh/skills` |
| 200 | `project-agents` | `<projectRoot>/.agents/skills` |
| 300 | `custom` | whatever `customSkillDirs` lists |
| 400 | `user-dsh` | `$DSH_HOME/skills`, default `~/.dsh/skills` |
| 500 | `user-agents` | `$DSH_AGENTS_HOME/skills`, default `~/.agents/skills` |
| 600 | `bundled` | `bundledSkillDir` when a deployment configures one |

Three details that bite. The project root is the nearest ancestor containing `.git`, falling back to the cwd, so running from a subdirectory of a monorepo can silently pick a different root than you expect. The user DSH root skips its `.system` child. Nested discovery is not supported, a `SKILL.md` must sit one level under a root, not at `**/SKILL.md`.

`dsh-movein` writes into rank 100 and rank 400 (the `.dsh` pair) because those are DSH's own namespace, and `doctor` checks every root above for the silent-drop frontmatter shape, including the `.agents` ones you may have filled by hand.

> rc.7 note (2026-08-17, day of release). The full flow was re-verified against `0.1.0-rc.7` within hours of it landing on npm, plugin boot, `--apply`, composed `dsh-mcp-client` rows and `doctor` all pass unchanged. The table below was measured on rc.6 source and still holds.

## Four traps measured the hard way

1. **A patch row whose package the profile cannot resolve makes `dsh web` boot fatally** (plugin tree failed to load), not a warning. Install first, write config rows only after the package resolves.
2. **Satellite npm dist-tags lag the core.** The hooks bridge's `latest` was `0.0.1-rc.5` while dsh itself was `0.1.0-rc.6`. Pin installs to the host dsh version.
3. **`@deepseek-ai/dsh-hook-protocol` is a peer the host install does not ship.** Installing the hooks bridge alone still fails at boot, install the protocol package alongside.
4. **`dsh plugin add` never installs a release younger than 24 hours.** dsh forwards installs to pnpm, and pnpm 11 ships a default supply-chain cooldown (`minimumReleaseAge` = 1440 minutes). A fresh `dsh plugin add <pkg>` silently picks the newest version older than a day and prints `(x.y.z is available)` for the one it skipped. Measured here: with 0.5.0 published 2h ago and 0.4.0 published 20h ago, a clean profile got 0.3.2 (30h old), reproduced independently on two machines. `npx <pkg>` goes through npm and gets `latest` immediately. If you ship a plugin, publish at least a day before you announce.

`npx dsh-movein` automates every row of this table that can be automated, with a dry run first and a migration diff report for the rules that cannot map.

## 中文摘要

- 项目 CLAUDE.md 原生兼容，DSH 默认就读，一行都不用动
- 全局 CLAUDE.md 链接为 `~/.dsh/AGENTS.md` 即可
- SKILL.md 格式原样兼容，但 `.claude/skills` 不是 DSH 的默认技能根，需要落到 `~/.dsh/skills`
- `.mcp.json` 可无损机械转换，工具名 `mcp__server__tool` 两边完全一致
- hooks 有官方桥（30 个事件映射 7 个），权限规则无原生对应但可在 `tools/pre-execute` 桥接
- 子代理无法直接导入，转成技能最现实；会话文件格式 v0 无兼容承诺，绝对不要手写
- 三个坑：解析不到的包会让 dsh 启动直接失败、周边包 npm 标签落后于核心、hook-protocol 是宿主不带的 peer 依赖
