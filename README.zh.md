# claude-to-opencode

[English](./README.md)

<p align="center">
  <a href="https://www.npmjs.com/package/opencode-claude-code-hooks"><img alt="OpenCode plugin" src="https://img.shields.io/npm/v/opencode-claude-code-hooks?label=OpenCode%20plugin&style=flat-square&color=4b6fff"></a>
  <a href="https://www.npmjs.com/package/claude-to-opencode"><img alt="migration CLI" src="https://img.shields.io/npm/v/claude-to-opencode?label=migration%20CLI&style=flat-square&color=8250df"></a>
  <a href="https://github.com/sjh9714/claude-to-opencode/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/sjh9714/claude-to-opencode/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-2EA44F?style=flat-square"></a>
</p>

切换到 OpenCode 时，继续使用 Claude Code 的命令防线。

OpenCode 已经原生读取 `CLAUDE.md` 和 Claude skills。缺少的是能真正阻止工具调用的确定性命令型 hooks。把原生桥接 package 加进 OpenCode 配置即可。

```json
{
  "plugin": ["opencode-claude-code-hooks"]
}
```

原有的 `Bash` 阻止规则、密钥检查和编辑后 lint 继续从 Claude 原始设置运行。每次工具调用都会重新读取设置，修改 Claude hook 后不需要重装 plugin。

## 先检查 hook 桥

修改 OpenCode 配置前，可以先查看支持范围。

```sh
npx claude-to-opencode --hooks-only
npx claude-to-opencode --hooks-only --apply
```

第一条命令只预演。第二条只安装同一个本地桥，不修改记忆、rules、commands、agents 或 MCP 配置。OpenCode 的 `bash` 等工具名会映射成 Claude matcher 使用的 `Bash` 等名称。

## 搬移其余 Claude Code 配置

```sh
npx claude-to-opencode
npx claude-to-opencode --apply
```

完整路径会先预演，再搬移其余兼容的 Claude Code 配置。多来源 CLI 运行同一条路径。

```sh
npx dsh-movein --from claude --to opencode
npx dsh-movein --from claude --to opencode --apply
```

![Claude Code 配置安全搬进 OpenCode](https://raw.githubusercontent.com/sjh9714/claude-to-opencode/main/docs/demo.gif)

动画复现真实 CLI 流程。生成结果还通过 OpenCode `1.18.21` 的 `debug config`、`debug skill` 和 `debug agent` 实际加载验证。

- 全局和项目 `CLAUDE.md` 在目标空闲时连接到对应的 OpenCode `AGENTS.md`
- 当前项目的 Claude 自动记忆保留在原处，由项目 OpenCode 配置直接引用，后续更新仍然可见
- 无路径条件的 `.claude/rules` 写入 OpenCode instructions；带路径条件的规则保持手动检查，避免错误地全局生效
- OpenCode 原生读取 `.claude/skills`，所以不会重复复制 skills
- commands 原样复制，`$ARGUMENTS` 保持不变
- Claude subagents 转成 OpenCode subagents，不猜测工具权限
- 用户级和项目级 MCP 分别合并进对应的 OpenCode JSON 或 JSONC
- Claude `PreToolUse` 和 `PostToolUse` 命令型 hooks 通过生成的 OpenCode plugin 运行，plugin 会在运行时读取原始 Claude 设置
- 保留 matcher、退出码 2 阻止、结构化 deny、`updatedInput` 和工具执行后的反馈
- `${VAR}` 转成 `{env:VAR}`，不会读取当前环境值
- 已有目标和同名 MCP 跳过
- 疑似明文密钥的 MCP 只报告，不复制
- 目标配置解析失败时阻止全部写入

## 搬进 DSH

```sh
# Claude Code
npx dsh-movein
npx dsh-movein --apply

# Codex
npx dsh-movein --from codex
npx dsh-movein --from codex --apply

# OpenCode
npx dsh-movein --from opencode
npx dsh-movein --from opencode --apply
```

没有 `--apply` 时只预演。需要复制技能而不是符号链接时加 `--copy`。

## 在 DSH 内使用

```sh
dsh plugin --profile web add dsh-movein
```

重启 `dsh web`。插件会注册两个工具。

- `movein_from_claude_code`
- `movein_from_opencode`

两个工具默认都只预演，确认后传入 `apply=true`。

## 兼容范围

| 路径 | 搬入内容 |
| --- | --- |
| Claude Code 到 OpenCode | 自动记忆、指令、无路径条件的 rules、commands、subagents、本地与远程 MCP、`PreToolUse` 和 `PostToolUse` 命令型 hooks。skills 原生读取，不重复复制 |
| Claude Code 到 DSH | 全局与项目指令、技能、斜杠命令、MCP、已支持 hooks、子代理和可映射权限规则 |
| Codex 到 DSH | 全局 `AGENTS.md`、自定义 prompts 和 `config.toml` 中的 stdio MCP |
| OpenCode 到 DSH | JSON 或 JSONC 中的指令、技能、命令、agents、本地与远程 MCP |

[完整兼容性表](docs/compat.md) 会逐项说明来源路径、DSH 目标、保留行为和不支持内容。

## OpenCode 支持

`--from opencode` 按 OpenCode 的优先级读取全局设置、`OPENCODE_CONFIG`、项目设置、`.opencode` 目录和 `OPENCODE_CONFIG_DIR`。同名定义以更靠近项目的版本为准。

支持 `opencode.json` 和 `opencode.jsonc`，包括注释和尾逗号。

- `skill` 和 `skills` 目录搬成 DSH skills
- `agent` 和 `agents` 文件转换为 DSH skills
- `command` 和 `commands` 文件转换为用户可调用的 DSH skills
- 内联 agents 和 commands 与文件资产采用同一转换
- 本地 MCP command 数组拆成 DSH stdio command 和 args
- 远程 MCP 转成 streamable HTTP 配置
- 已禁用 MCP 不搬入，但会显示在报告中
- `{env:VAR}` 保留为运行时 `process.env.VAR` 引用
- `{file:path}` 保留供人工检查，dsh-movein 不会读取文件内容

项目 `AGENTS.md` 不用搬，DSH 原生读取。只有一个全局 instruction 文件且 `~/.dsh/AGENTS.md` 不存在时才会建立链接。多个文件、glob、URL、OpenCode permissions 和 plugins 都只报告，不猜测转换。

任何 JSONC 无法解析时，`--apply` 会在首次写入前停止。

## 安全边界

- 默认只预演
- 已有目标跳过
- 保留 OpenCode JSONC 注释和无关设置
- 自动记忆从原本地文件引用，不复制
- hook 命令保留在原始 Claude 设置中，OpenCode 运行时再读取
- 合并前在原文件旁创建 OpenCode 配置备份
- `~/.config/opencode/dsh-movein-manifest.json` 记录搬家结果
- Windows 拒绝创建符号链接时会自动改为复制，并在报告中注明
- 每次写入前备份 `cordis.patch.yml`
- `npx dsh-movein restore` 恢复最新备份
- `~/.dsh/movein-manifest.json` 记录来源和目标
- 环境变量占位符保留为运行时引用
- 预演会报告疑似明文密钥
- sessions 不在范围内

## 搬完检查

```sh
npx dsh-movein doctor
dsh --profile web --dump-config | grep -E "mcp-|cc-hooks"
```

技能目录按 session 固定，所以搬完后请新建 DSH session。

## Claude Code 双栖

DSH 原生技能可以搬回 Claude Code。从 Claude Code 搬来的资产会识别并跳过。

```sh
npx dsh-movein --reverse
npx dsh-movein --reverse --apply
```

反向搬家目前只支持 Claude Code。

## 不搬内容

- sessions
- `PreToolUse` 和 `PostToolUse` 以外的 Claude hook 事件
- Claude prompt、agent、HTTP、async 和条件 `if` hooks
- OpenCode permissions 和 plugins
- Codex approval 与 sandbox policy
- 多个 instruction 文件、glob 和远程 URL
- 反向搬家时手写的 DSH MCP 与 hook 配置

会话历史请使用 [dsh-chat-import](https://github.com/Nwflower/dsh-chat-import)。

## 项目状态

已在 OpenCode `1.18.21`、DSH `0.1.0-rc.6` 和 `0.1.0-rc.7` 完成端到端验证。CI 使用 `npm ci` 在 Linux、macOS 和 Windows 上运行同一套测试。

## 许可

MIT
