# dsh-movein

[中文](./README.zh.md)

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-movein"><img alt="npm" src="https://img.shields.io/npm/v/dsh-movein?style=flat-square&color=4b6fff"></a>
  <a href="https://github.com/sjh9714/dsh-movein/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/sjh9714/dsh-movein/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-2EA44F?style=flat-square"></a>
  <img alt="zero dependencies" src="https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square">
  <a href="https://www.npmjs.com/package/dsh-movein"><img alt="downloads" src="https://img.shields.io/npm/dm/dsh-movein?style=flat-square&color=8250df"></a>
</p>

<p align="center">
  Listed in <a href="https://github.com/awesome-dsh-plugin/awesome-dsh-plugin">awesome-dsh-plugin</a> · <a href="https://github.com/0xsline/awesome-deepseek-harness">awesome-deepseek-harness</a> · cited by <a href="https://github.com/Electricitysheep/dsh-handbook">dsh-handbook</a>
</p>

Move your whole Claude Code setup into [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) with one command. Skills, MCP servers, hooks and instructions arrive together, so DSH feels like home from the first prompt.

从 Claude Code 拎包入住 DSH。一条命令搬完技能、MCP、hooks 和全局指令。

![dsh-movein demo](https://raw.githubusercontent.com/sjh9714/dsh-movein/main/docs/demo.gif)

```sh
dsh plugin --profile web add dsh-movein
```

Restart `dsh web`, then say "move my Claude Code setup over". The plugin exposes a `movein_from_claude_code` tool (dry run by default, `apply=true` to move).

Or run it standalone, no DSH plugin needed:

```sh
npx dsh-movein            # dry run, shows the moving estimate
npx dsh-movein --apply    # actually move in
npx dsh-movein doctor     # verify the move afterwards, any time
```

```
📦 dsh-movein · Claude Code -> DeepSeek Harness moving estimate · 拎包入住

  → CLAUDE.md (global) .............. link ~/.dsh/AGENTS.md -> ~/.claude/CLAUDE.md
  → skill computer-use .............. link -> ~/.dsh/skills/computer-use
  → skill design-taste-frontend ..... link -> ~/.dsh/skills/design-taste-frontend
  → MCP servers + hooks ............. write generated block into ~/.dsh/cordis.patch.yml

  found: 4 skills · 2 commands · 3 MCP servers · 1 hook configs · 5 subagents · 878 sessions
```

**[The full Claude Code → DSH compatibility matrix](docs/compat.md)** documents what every asset type does in DSH, measured against the source, including the parts no tool can automate. 完整的实测兼容性对照表见 [docs/compat.md](docs/compat.md)。

## What moves

| Asset | How |
|---|---|
| Project `CLAUDE.md` | Nothing to do. DSH reads it natively |
| Global `~/.claude/CLAUDE.md` | Linked to `~/.dsh/AGENTS.md` |
| Skills (`.claude/skills`) | Symlinked into DSH skill roots. The `SKILL.md` format is compatible as is |
| MCP servers (`.mcp.json`) | Converted to `dsh-mcp-client` rows in `~/.dsh/cordis.patch.yml`. Tool names (`mcp__server__tool`) stay identical |
| Hooks (`settings.json`) | Wired through the first party `dsh-hooks-claude-code` bridge, your `hooks` config runs unchanged |
| Subagents (`.claude/agents`) | Converted to DSH skills, the system prompt becomes the skill body |
| Slash commands (`.claude/commands`) | Converted to user-invocable DSH skills, you keep typing `/name` |
| Permission rules (`settings.json`) | `deny` and `ask` rules enforced at DSH's `tools/pre-execute` gate via the companion [dsh-movein-permissions](plugin/) plugin. `allow` rules stay with the DSH preset. Prefer [dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules)? `--emit-rules` prints your rules in its YAML shape |

Skills are symlinked by default so edits keep flowing both ways. Pass `--copy` for real copies.

`${VAR}` values in MCP `env` become `process.env` references, secrets are never inlined into the generated YAML.

## Reverse moving day (dual boot)

Skills you build inside DSH can come back:

```sh
npx dsh-movein --reverse            # what would come back
npx dsh-movein --reverse --apply    # bring it back
```

DSH-born skills land in `.claude/skills` (symlinked, so both sides stay current), a DSH-born `AGENTS.md` links to `CLAUDE.md` when Claude Code has none. Assets that originally moved in from Claude Code are recognized and skipped, they never left. Use both tools, keep one setup. 在 DSH 里长出来的技能可以搬回 Claude Code，双栖不二选。

## After the move

```sh
npx dsh-movein doctor
```

A post-move health check, run it any time. It verifies that every recorded destination still exists, that no moved skill has the frontmatter shape DSH's YAML parser silently drops ([#1401](https://github.com/deepseek-ai/deepseek-harness/discussions/1401)), that every package referenced in `cordis.patch.yml` still resolves (an unresolvable row is a fatal boot in DSH, not a warning), and that hook matchers will not miss DSH's lowercase tool names ([#582](https://github.com/deepseek-ai/deepseek-harness/issues/582)).

If an apply left you worse off, `npx dsh-movein restore` puts back the newest `cordis.patch.yml` backup. A backup is taken automatically before every write.

## Safe to run

- **Dry run is the default.** Nothing is written without `--apply`, and the estimate shows every planned change first.
- **Backup before write.** `cordis.patch.yml` is copied to `~/.dsh/movein-backups/` before each apply, `restore` brings it back.
- **Zero dependencies, small enough to read.** Plain Node, no install scripts, you can audit the whole thing before running it.
- **Every move is on the record.** `~/.dsh/movein-manifest.json` logs source and destination per applied move, so "where did this skill come from" stays answerable.
- **Secrets stay out of generated config.** `${VAR}` values become `process.env` references, and the dry run warns if a plaintext secret-looking value (API key shapes) would be copied into `~/.dsh`.

## What does not move

- **Sessions**. Out of scope here. For conversation history see [dsh-chat-import](https://github.com/Nwflower/dsh-chat-import).
- **DSH-born MCP and hook rows** (on `--reverse`). Hand-written cordis patches are not machine-reversible, the report says so instead of guessing.

## Roadmap

| Next | What |
|---|---|
| ~~Reverse moving day~~ | **Shipped in v0.4.0**, `--reverse` brings DSH-born skills and instructions back |
| ~~`doctor`~~ | **Shipped in v0.5.0**, post-move health check plus `restore` from automatic backups |
| [More origins](https://github.com/sjh9714/dsh-movein/issues/3) | Codex and Gemini CLI setups moving into DSH the same way |
| [`--watch`](https://github.com/sjh9714/dsh-movein/issues/2) | On hold. dsh-chat-import shipped a sync panel that covers much of this, details on the issue |

A thumbs up on an issue is a vote for what ships next. Releases land fast here, four shipped in the first two days. 计划中：反向搬家（DSH 配置导回 Claude Code，双栖不二选）、--watch 双向同步、支持从 Codex/Gemini CLI 搬入。

## See also

- [dsh-handbook](https://github.com/Electricitysheep/dsh-handbook) chapter 1 has a good "dsh vs Claude Code" comparison, and its [ecosystem chapter](https://github.com/Electricitysheep/dsh-handbook/blob/main/docs/07-ecosystem.md) lists dsh-movein for the migration path.

## Verify

```sh
dsh --profile web --dump-config | grep -E "mcp-|cc-hooks"
```

Then restart `dsh web`. Counted, scanned and moved on this exact layout against dsh `0.1.0-rc.6`.

## Notes

- **Migration diff report.** Permission rules are never converted silently. The report says how many deny and ask rules are enforced, lists every rule that has no DSH-side tool to map to, and notes that `*` patterns match as a superset. Fail closed beats fail open.
- **Hook environment scan.** The dry run scans hook commands for env vars DSH will not provide (`$CLAUDE_PROJECT_DIR` and `$CLAUDE_PLUGIN_ROOT` are substituted by the bridge, anything else unknown gets a warning) so hooks do not silently break on first fire.
- **Silent-drop warning.** Skills whose `description` contains an unquoted `": "` vanish from DSH's catalog without an error ([#1401](https://github.com/deepseek-ai/deepseek-harness/discussions/1401), full writeup in [docs/skill-vanish.md](docs/skill-vanish.md)). The dry run and `doctor` both flag that shape before it bites.
- Re-running is safe. Existing links are skipped and the generated YAML block is replaced in place, your own rows are preserved.
- Needed packages (`dsh-hooks-claude-code`, `dsh-hook-protocol`) are installed into the profile automatically, pinned to your dsh version.
- DSH is a developer preview. When plugin contracts change we patch fast.

---

## 中文说明

**dsh-movein** 把你的 Claude Code 配置一次性搬进 DeepSeek Harness。

```sh
dsh plugin --profile web add dsh-movein
```

重启 `dsh web` 后说"帮我把 Claude Code 的配置搬过来"即可（`movein_from_claude_code` 工具，默认预演）。也可以独立运行：

```sh
npx dsh-movein            # 预演，先看搬家清单
npx dsh-movein --apply    # 正式入住
npx dsh-movein doctor     # 搬完随时体检
```

权限规则迁移会输出差异报告（几条原样生效、几条无法映射都列出来），hooks 里引用的未知环境变量在预演阶段就会警告，每次搬家都记录 manifest 便于溯源。

搬什么

- 项目 `CLAUDE.md` 不用搬，DSH 原生就读
- 全局 `~/.claude/CLAUDE.md` 链接为 `~/.dsh/AGENTS.md`
- 技能目录符号链接进 DSH 技能根，`SKILL.md` 格式直接兼容
- 斜杠命令（`.claude/commands`）转换为用户可调用的 DSH 技能，`/name` 照常用
- `.mcp.json` 自动转换为 `dsh-mcp-client` 配置行，工具名 `mcp__server__tool` 完全一致
- `hooks` 通过官方 `dsh-hooks-claude-code` 桥原样运行
- 子代理（`.claude/agents`）自动转换为 DSH 技能
- 权限规则的 `deny` 与 `ask` 通过配套插件 dsh-movein-permissions 在 `tools/pre-execute` 强制执行，想用 dsh-permission-rules 的话 `--emit-rules` 可导出其 YAML 格式

搬完之后。`doctor` 检查搬过去的资产是否健在、技能会不会被 DSH 的 YAML 解析器静默丢弃（#1401）、`cordis.patch.yml` 引用的包是否可解析（解析不到会导致 dsh 无法启动）。每次写入前自动备份，`npx dsh-movein restore` 一键回滚。

会话历史不在范围内，请配合 [dsh-chat-import](https://github.com/Nwflower/dsh-chat-import) 使用。

默认预演，不加 `--apply` 不写任何文件。重复执行安全，生成块原地替换，你自己的配置行不受影响。密钥永不写入生成的 YAML，预演阶段还会对疑似明文密钥告警。

## Star history

[![Star History Chart](https://api.star-history.com/svg?repos=sjh9714/dsh-movein&type=Date)](https://star-history.com/#sjh9714/dsh-movein&Date)

## Related

After moving in, see where your tokens go: [dsh-lean](https://github.com/sjh9714/dsh-lean) audits a session's cache split per request and trims the DSH prompt prefix 53%. `npx dsh-lean audit`, nothing installed.

## License

MIT
