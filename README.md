# dsh-movein

Move your whole Claude Code setup into [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) with one command. Skills, MCP servers, hooks and instructions arrive together, so DSH feels like home from the first prompt.

从 Claude Code 拎包入住 DSH。一条命令搬完技能、MCP、hooks 和全局指令。

![dsh-movein demo](https://raw.githubusercontent.com/sjh9714/dsh-movein/main/docs/demo.gif)

```sh
npx dsh-movein            # dry run, shows the moving estimate
npx dsh-movein --apply    # actually move in
```

Or install it as a DSH plugin and ask the agent to do the move for you:

```sh
dsh plugin --profile web add dsh-movein
```

Restart `dsh web`, then say "move my Claude Code setup over". The plugin exposes a `movein_from_claude_code` tool (dry run by default, `apply=true` to move).

```
📦 dsh-movein · Claude Code -> DeepSeek Harness moving estimate · 拎包入住

  → CLAUDE.md (global) .............. link ~/.dsh/AGENTS.md -> ~/.claude/CLAUDE.md
  → skill computer-use .............. link -> ~/.dsh/skills/computer-use
  → skill design-taste-frontend ..... link -> ~/.dsh/skills/design-taste-frontend
  → MCP servers + hooks ............. write generated block into ~/.dsh/cordis.patch.yml

  found: 4 skills · 3 MCP servers · 1 hook configs · 5 subagents · 878 sessions
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
| Permission rules (`settings.json`) | `deny` and `ask` rules enforced at DSH's `tools/pre-execute` gate via the companion [dsh-movein-permissions](plugin/) plugin. `allow` rules stay with the DSH preset |

Skills are symlinked by default so edits keep flowing both ways. Pass `--copy` for real copies.

`${VAR}` values in MCP `env` become `process.env` references, secrets are never inlined into the generated YAML.

## What does not move

- **Sessions**. Out of scope here. For conversation history see [dsh-chat-import](https://github.com/Nwflower/dsh-chat-import).

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
- **Manifest.** Every applied move is recorded in `~/.dsh/movein-manifest.json` with source and destination, so "where did this skill come from" stays answerable.
- Dry run is the default. Nothing is written without `--apply`.
- Re-running is safe. Existing links are skipped and the generated YAML block is replaced in place, your own rows are preserved.
- Needed packages (`dsh-hooks-claude-code`, `dsh-hook-protocol`) are installed into the profile automatically, pinned to your dsh version.
- DSH is a developer preview. When plugin contracts change we patch fast.

---

## 中文说明

**dsh-movein** 把你的 Claude Code 配置一次性搬进 DeepSeek Harness。

```sh
npx dsh-movein            # 预演，先看搬家清单
npx dsh-movein --apply    # 正式入住
```

也可以装成 DSH 插件，直接让 agent 帮你搬：

```sh
dsh plugin --profile web add dsh-movein
```

重启 `dsh web` 后说"帮我把 Claude Code 的配置搬过来"即可（`movein_from_claude_code` 工具，默认预演）。权限规则迁移会输出差异报告（几条原样生效、几条无法映射都列出来），hooks 里引用的未知环境变量在预演阶段就会警告，每次搬家都记录 manifest 便于溯源。

搬什么

- 项目 `CLAUDE.md` 不用搬，DSH 原生就读
- 全局 `~/.claude/CLAUDE.md` 链接为 `~/.dsh/AGENTS.md`
- 技能目录符号链接进 DSH 技能根，`SKILL.md` 格式直接兼容
- `.mcp.json` 自动转换为 `dsh-mcp-client` 配置行，工具名 `mcp__server__tool` 完全一致
- `hooks` 通过官方 `dsh-hooks-claude-code` 桥原样运行
- 子代理（`.claude/agents`）自动转换为 DSH 技能
- 权限规则的 `deny` 与 `ask` 通过配套插件 dsh-movein-permissions 在 `tools/pre-execute` 强制执行

会话历史不在范围内，请配合 [dsh-chat-import](https://github.com/Nwflower/dsh-chat-import) 使用。

默认预演，不加 `--apply` 不写任何文件。重复执行安全，生成块原地替换，你自己的配置行不受影响。

## License

MIT
