# dsh-movein

[English](./README.md)

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-movein"><img alt="npm" src="https://img.shields.io/npm/v/dsh-movein?style=flat-square&color=4b6fff"></a>
  <a href="https://github.com/sjh9714/dsh-movein/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/sjh9714/dsh-movein/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-2EA44F?style=flat-square"></a>
</p>

离开 Claude Code 时，不用重建已经积累的配置。

一条命令先预演，再把自动记忆、指令、无路径条件的 rules、命令、agents 和 MCP 搬进 OpenCode。同一个 CLI 也能把 Claude Code、Codex 或 OpenCode 资产搬进 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness)。

![Claude Code 配置安全搬进 OpenCode](https://raw.githubusercontent.com/sjh9714/dsh-movein/main/docs/demo.gif)

动画复现真实 CLI 流程。生成结果还通过 OpenCode `1.18.21` 的 `debug config`、`debug skill` 和 `debug agent` 实际加载验证。

## Claude Code 搬到 OpenCode

```sh
npx dsh-movein --from claude --to opencode
npx dsh-movein --from claude --to opencode --apply
```

也可以使用更短、便于搜索的同一入口。

```sh
npx claude-to-opencode
npx claude-to-opencode --apply
```

第一条命令只预演，不写文件。

- 全局和项目 `CLAUDE.md` 在目标空闲时连接到对应的 OpenCode `AGENTS.md`
- 当前项目的 Claude 自动记忆保留在原处，由项目 OpenCode 配置直接引用，后续更新仍然可见
- 无路径条件的 `.claude/rules` 写入 OpenCode instructions；带路径条件的规则保持手动检查，避免错误地全局生效
- OpenCode 原生读取 `.claude/skills`，所以不会重复复制 skills
- commands 原样复制，`$ARGUMENTS` 保持不变
- Claude subagents 转成 OpenCode subagents，不猜测工具权限
- 用户级和项目级 MCP 分别合并进对应的 OpenCode JSON 或 JSONC
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
| Claude Code 到 OpenCode | 自动记忆、指令、无路径条件的 rules、commands、subagents、本地与远程 MCP。skills 原生读取，不重复复制 |
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
- OpenCode permissions 和 plugins
- Codex approval 与 sandbox policy
- 多个 instruction 文件、glob 和远程 URL
- 反向搬家时手写的 DSH MCP 与 hook 配置

会话历史请使用 [dsh-chat-import](https://github.com/Nwflower/dsh-chat-import)。

## 项目状态

已在 OpenCode `1.18.21`、DSH `0.1.0-rc.6` 和 `0.1.0-rc.7` 完成端到端验证。CI 使用 `npm ci` 在 Linux、macOS 和 Windows 上运行同一套测试。

## 许可

MIT
