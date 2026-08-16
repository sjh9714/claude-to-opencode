# dsh-movein

[English](./README.md)

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-movein"><img alt="npm" src="https://img.shields.io/npm/v/dsh-movein?style=flat-square&color=4b6fff"></a>
  <a href="https://github.com/sjh9714/dsh-movein/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/sjh9714/dsh-movein/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-2EA44F?style=flat-square"></a>
  <img alt="zero dependencies" src="https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square">
  <a href="https://www.npmjs.com/package/dsh-movein"><img alt="downloads" src="https://img.shields.io/npm/dm/dsh-movein?style=flat-square&color=8250df"></a>
</p>

一条命令，把整套 Claude Code 配置搬进 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness)。技能、MCP、hooks、全局指令一起到位，从 Claude Code 拎包入住。

![dsh-movein demo](https://raw.githubusercontent.com/sjh9714/dsh-movein/main/docs/demo.gif)

```sh
dsh plugin --profile web add dsh-movein
```

重启 `dsh web` 后说「帮我把 Claude Code 的配置搬过来」即可，插件注册了 `movein_from_claude_code` 工具，默认预演。

也可以独立运行，不装插件。

```sh
npx dsh-movein            # 预演，先看搬家清单
npx dsh-movein --apply    # 正式入住
npx dsh-movein doctor     # 搬完随时体检
```

**实测兼容性对照表见 [docs/compat.md](./docs/compat.md)**，每类资产在 DSH 里到底会怎样，按 rc.6 源码逐项验证，含无法自动化的部分。

## 能搬什么

| 资产 | 怎么搬 |
| --- | --- |
| 项目 CLAUDE.md | 不用搬。DSH 原生就读 |
| 全局 `~/.claude/CLAUDE.md` | 链接为 `~/.dsh/AGENTS.md` |
| 技能 | 符号链接进 DSH 技能根，`SKILL.md` 格式原样兼容，原文件改动两边同步 |
| `.mcp.json` | 机械转换为 `dsh-mcp-client` 配置行，工具名 `mcp__server__tool` 两边完全一致 |
| hooks | 官方 `dsh-hooks-claude-code` 桥直接跑你现有的配置 |
| 子代理（`.claude/agents`） | 自动转换为 DSH 技能 |
| 斜杠命令（`.claude/commands`） | 转换为用户可调用的 DSH 技能，`/name` 照常用 |
| 权限规则 | `deny` 与 `ask` 通过配套插件 [dsh-movein-permissions](./plugin/) 在 `tools/pre-execute` 强制执行，无法映射的规则逐条列进迁移差异报告，绝不静默丢弃。想用 dsh-permission-rules 引擎的话，`--emit-rules` 可导出其 YAML 格式 |

会话历史不在范围内，请配合 [dsh-chat-import](https://github.com/Nwflower/dsh-chat-import) 使用。

## 反向搬家（双栖）

在 DSH 里长出来的技能可以搬回去。

```sh
npx dsh-movein --reverse            # 看看有什么能搬回去
npx dsh-movein --reverse --apply    # 搬回 Claude Code
```

DSH 原生技能落到 `.claude/skills`（符号链接，两边保持最新）。当年从 Claude Code 搬来的资产会被识别并跳过，它们从来没离开过。两个工具都用，配置只维护一套。

## 搬完之后

```sh
npx dsh-movein doctor
```

搬家体检，随时可跑。检查每个搬过去的资产是否健在、有没有技能会被 DSH 的 YAML 解析器静默丢弃（[#1401](https://github.com/deepseek-ai/deepseek-harness/discussions/1401)，详见 [docs/skill-vanish.md](./docs/skill-vanish.md)）、`cordis.patch.yml` 引用的包是否可解析（解析不到 dsh 会直接无法启动）、hook matcher 大小写会不会匹配不上（[#582](https://github.com/deepseek-ai/deepseek-harness/issues/582)）。

搬坏了就 `npx dsh-movein restore`，每次写入前都自动备份到 `~/.dsh/movein-backups/`。

## 设计原则

- 默认 dry run，不加 `--apply` 不写任何文件
- 每次写入 `cordis.patch.yml` 前自动备份，`restore` 一键回滚
- 零依赖，纯 Node，代码量小到可以先读完再跑
- 重复执行安全，生成块原地替换，自己写的配置行不受影响
- 权限迁移出差异报告（几条生效、几条映射不了都列出来），fail closed 优先于静默转换
- 预演阶段扫描 hook 命令里的未知环境变量，搬完才炸不如搬前就警告
- 密钥永不写入生成的 YAML，`${VAR}` 转成 `process.env` 引用，疑似明文密钥预演即告警
- 每次搬家记录 manifest（`~/.dsh/movein-manifest.json`），「这个技能从哪来」永远可查
- 所需包按宿主 dsh 版本锁定安装，解析不到的包绝不写进配置（那会让 dsh 启动直接失败）

## 每请求 token 账单

搬进来的技能不是免费的，技能目录以 system-reminder 注入每个请求，固定 143 token，每个技能约 28 token。搬家前先精简，实测数据与复现脚本见 [docs/token-bill.md](./docs/token-bill.md)。

## 许可

MIT
