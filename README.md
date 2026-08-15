# dsh-movein

Move your whole Claude Code setup into [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) with one command. Skills, MCP servers, hooks and instructions arrive together, so DSH feels like home from the first prompt.

从 Claude Code 拎包入住 DSH。一条命令搬完技能、MCP、hooks 和全局指令。

```sh
npx dsh-movein            # dry run, shows the moving estimate
npx dsh-movein --apply    # actually move in
```

```
📦 dsh-movein · Claude Code -> DeepSeek Harness moving estimate · 拎包入住

  → CLAUDE.md (global) .............. link ~/.dsh/AGENTS.md -> ~/.claude/CLAUDE.md
  → skill computer-use .............. link -> ~/.dsh/skills/computer-use
  → skill design-taste-frontend ..... link -> ~/.dsh/skills/design-taste-frontend
  → MCP servers + hooks ............. write generated block into ~/.dsh/cordis.patch.yml

  found: 4 skills · 3 MCP servers · 1 hook configs · 5 subagents · 878 sessions
```

## What moves

| Asset | How |
|---|---|
| Project `CLAUDE.md` | Nothing to do. DSH reads it natively |
| Global `~/.claude/CLAUDE.md` | Linked to `~/.dsh/AGENTS.md` |
| Skills (`.claude/skills`) | Symlinked into DSH skill roots. The `SKILL.md` format is compatible as is |
| MCP servers (`.mcp.json`) | Converted to `dsh-mcp-client` rows in `~/.dsh/cordis.patch.yml`. Tool names (`mcp__server__tool`) stay identical |
| Hooks (`settings.json`) | Wired through the first party `dsh-hooks-claude-code` bridge, your `hooks` config runs unchanged |

Skills are symlinked by default so edits keep flowing both ways. Pass `--copy` for real copies.

`${VAR}` values in MCP `env` become `process.env` references, secrets are never inlined into the generated YAML.

## What does not move yet

- **Subagents** (`.claude/agents`). Planned, they will convert to skills.
- **Permission rules**. Planned, via a `tools/pre-execute` bridge plugin.
- **Sessions**. Out of scope here. For conversation history see [dsh-chat-import](https://github.com/Nwflower/dsh-chat-import).

## Verify

```sh
dsh --profile web --dump-config | grep -E "mcp-|cc-hooks"
```

Then restart `dsh web`. Counted, scanned and moved on this exact layout against dsh `0.1.0-rc.6`.

## Notes

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

搬什么

- 项目 `CLAUDE.md` 不用搬，DSH 原生就读
- 全局 `~/.claude/CLAUDE.md` 链接为 `~/.dsh/AGENTS.md`
- 技能目录符号链接进 DSH 技能根，`SKILL.md` 格式直接兼容
- `.mcp.json` 自动转换为 `dsh-mcp-client` 配置行，工具名 `mcp__server__tool` 完全一致
- `hooks` 通过官方 `dsh-hooks-claude-code` 桥原样运行

暂不搬的部分（规划中）为子代理与权限规则，会话历史请配合 [dsh-chat-import](https://github.com/Nwflower/dsh-chat-import) 使用。

默认预演，不加 `--apply` 不写任何文件。重复执行安全，生成块原地替换，你自己的配置行不受影响。

## License

MIT
