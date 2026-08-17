# The Claude Code → DeepSeek Harness compatibility matrix

Everything a Claude Code setup contains, and what actually happens to each piece in DSH. Measured against the DSH source at `0.1.0-rc.6` on 2026-08-15, not guessed. This is the research dsh-movein automates, published because nothing like it existed.

一份实测的 Claude Code 与 DeepSeek Harness 资产兼容性对照表，基于 DSH `0.1.0-rc.6` 源码逐项验证。中文摘要在文末。

| Claude Code asset | DSH compatibility | What actually happens |
|---|---|---|
| Project `CLAUDE.md` | **Native, zero work** | `instructionFileCandidates` defaults to `['AGENTS.md', 'CLAUDE.md']`, local variants too. DSH discovers it from project root down to cwd and renders it the same system-reminder way Claude Code does |
| Global `~/.claude/CLAUDE.md` | **One symlink** | The global slot is `$DSH_HOME/AGENTS.md` only, no CLAUDE.md fallback there. Link it and you are done |
| Skills (`SKILL.md`) | **Format compatible as is** | Frontmatter parses as an open object, only `name` and `description` are required, unknown keys (`allowed-tools`, `license`, ...) are ignored. But `.claude/skills` is NOT a default root, skills must land in `~/.dsh/skills` or `<project>/.dsh/skills` |
| Slash-invoking skills | **Same UX** | Users type `/name`, the model loads via a skill tool, same shape both sides |
| MCP servers (`.mcp.json`) | **Lossless mechanical conversion** | One `dsh-mcp-client` config row per server (stdio and streamable-http). Tool names are literally identical, `mcp__server__tool` on both sides, so nothing referencing them breaks |
| Hooks (`settings.json` `hooks`) | **First party bridge, partial events** | `@deepseek-ai/dsh-hooks-claude-code` runs your existing hooks config unchanged, same stdin payload, exit code and matcher semantics, `${CLAUDE_PROJECT_DIR}` substituted. 7 of 30 events mapped (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop, SubagentStart, SubagentStop), the rest silently skipped. Command hooks only. Known upstream bug, matchers are case sensitive against DSH tool names, a `Bash` matcher does not select the lowercase `bash` tool so security hooks can fail silently (deepseek-harness discussion #582), write matchers lowercase until fixed |
| Permission rules | **Not native, bridgeable** | DSH has three coarse presets and no per tool allowlist. `deny`/`ask` rules can be enforced at the `tools/pre-execute` gate ([dsh-movein-permissions](../plugin/)), `allow` rules have no equivalent, the DSH preset governs the default |
| Subagents (`.claude/agents/*.md`) | **No direct import** | DSH agent presets are directories with `agent.cordis.yml`, not markdown. The practical path is converting agent definitions to skills (frontmatter is nearly identical). Fun fact, DSH ships a `subagent-claude-code` provider that literally spawns `claude` as a child agent |
| Slash commands (`.claude/commands/*.md`) | **No file equivalent** | DSH commands are code-registered. User-invocable skills are the file-based substitute |
| Sessions | **Hardest, avoid writing** | `~/.dsh/sessions` uses zstd-framed JSONL at `SESSION_FORMAT_VERSION = 0` with an explicit no-compatibility promise and strict event invariants. Import history as plugin-sourced recall messages, never by writing session files. For conversation history use [dsh-chat-import](https://github.com/Nwflower/dsh-chat-import) |
| Memory / `~/.claude` misc | **Manual** | No DSH counterpart, carry what matters into `AGENTS.md` or skills |

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
