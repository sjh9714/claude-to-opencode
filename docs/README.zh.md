# dsh-movein

[English](../README.md)

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-movein"><img alt="npm" src="https://img.shields.io/npm/v/dsh-movein?style=flat-square&color=4b6fff"></a>
  <a href="https://github.com/sjh9714/dsh-movein/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/sjh9714/dsh-movein/actions/workflows/ci.yml/badge.svg"></a>
  <a href="../LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-2EA44F?style=flat-square"></a>
</p>

**用已有配置试试 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness)。**

继续使用 Claude Code，同时在 DSH 里试试熟悉的技能。先预览，选择要应用的类别，再在新会话中完成一项小任务。来源文件与已有目标保持不变。

![DSH 原生设置页预览并应用 Claude Code 环境](./settings-demo.gif)

这是 macOS 上真实 DSH `0.1.2-rc.1` Web host 与 dsh-movein `0.13.8` 的录屏，使用合成项目展示预览与应用。来源文件保持不变，迁入技能已逐字节核对；未运行模型任务。[完整录屏](./settings-demo.webm)。

如果它节省了配置时间，欢迎 [Star dsh-movein](https://github.com/sjh9714/dsh-movein)。

## 在 DSH 设置中搬入

```sh
dsh plugin --profile web add dsh-movein
```

重启 `dsh web`，打开 **Settings**，再选择 **Move in**。

让 coding agent 帮忙时，复制[安装、预演和检查指令](https://github.com/sjh9714/dsh-movein/blob/main/docs/agent-setup.md#中文)。想先看一个不碰自己配置的例子，可以运行[合成配置的真实搬入演示](https://github.com/sjh9714/dsh-movein/blob/main/docs/first-migration.zh.md)。

- Claude Code 是主路径
- 0.13.8+ 设置页默认只选择技能；Codex 默认选择指令
- 成功预览后才能应用；更改目录、来源或类别后需要重新预览
- 每一类内容都可以单独选择
- 冲突与不支持内容会在应用前显示
- Codex 和 OpenCode 保留在次级来源面板

插件也会注册 `movein_from_claude_code` 与 `movein_from_opencode`。两个工具默认只预演，确认后传入 `apply=true`。

## 完成第一项小任务

应用后，在同一项目中新建 DSH 会话，让它用一个迁入的技能完成小任务。检查技能是否真正加载、结果是否遵循技能指令。见[第一次任务指南](./first-task.md#中文)。

我们正在寻找 **5 位首次试用者**。卡住也有价值：请[告诉我们目标与停止的位置](https://github.com/sjh9714/dsh-movein/issues/new?template=first-run.md)，注明实际安装版本。安装成功不等于任务成功。

## 使用 CLI

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

## 兼容范围

| 来源 | 搬入内容 |
| --- | --- |
| Claude Code | 全局与项目指令、技能、斜杠命令、MCP、DSH 当前支持的 hook 配置子集、子代理和可映射权限规则 |
| Codex | 全局 `AGENTS.md`、自定义 prompts 和 `config.toml` 中的 stdio MCP |
| OpenCode | V1 或 V2 JSON 和 JSONC 中的指令、技能、命令、agents、本地与远程 MCP |

[完整兼容性表](./compat.md) 会逐项说明来源路径、DSH 目标、保留行为和不支持内容。

## 把 OpenCode 作为来源

`--from opencode` 按 OpenCode 的优先级读取全局设置、`OPENCODE_CONFIG`、项目设置、`.opencode` 目录和 `OPENCODE_CONFIG_DIR`。项目配置从 Git 根目录向当前目录依次加载，然后以相同顺序加载 `.opencode` 配置。

支持 `opencode.json` 和 `opencode.jsonc`，包括注释和尾逗号。

- `skill` 和 `skills` 目录搬成 DSH skills
- `agent` 和 `agents` 文件转换为 DSH skills
- `command` 和 `commands` 文件转换为用户可调用的 DSH skills
- 内联 agents 和 commands 与文件资产采用同一转换
- V1 agent 的 `prompt` 和 V2 agent 的 `system` 都成为 DSH skill 正文
- 本地 MCP command 数组拆成 DSH stdio command 和 args
- 远程 MCP 转成 streamable HTTP 配置
- 同时支持 V1 MCP map 和 V2 `mcp.servers` map
- 已禁用 MCP 不搬入，但会显示在报告中
- `{env:VAR}` 保留为运行时 `process.env.VAR` 引用
- `{file:path}` 保留供人工检查，dsh-movein 不会读取文件内容

项目 `AGENTS.md` 不用搬，DSH 原生读取。只有一个全局 instruction 文件且 `~/.dsh/AGENTS.md` 不存在时才会建立链接。多个文件、glob、URL、OpenCode permissions 和 plugins 都只报告，不猜测转换。

任何 JSONC 无法解析时，`--apply` 会在首次写入前停止。

## 安全边界

- 默认只预演
- 已有目标跳过
- Windows 拒绝创建符号链接时会自动改为复制，并在报告中注明
- 每次写入前备份 `cordis.patch.yml`
- `npx dsh-movein restore` 恢复最新备份
- `~/.dsh/movein-manifest.json` 记录 instruction、资产与生成配置的来源和目标；如果已有 instruction 目标与来源逐字节一致，安全地重复 apply 可以补回缺失的来源记录
- 环境变量占位符保留为运行时引用
- 预演会报告疑似明文密钥
- sessions 不在范围内

## 搬完检查

```sh
npx dsh-movein doctor
npx dsh-movein doctor --live
dsh --profile web --dump-config | grep -E "mcp-|cc-hooks"
```

`doctor` 只做静态检查，不执行任何用户 hook，也不改写 Claude 设置。它会区分“bridge 与依赖已经接好”和“运行时强制已经验证”：前者可以自动确认，后者必须在临时项目的新 DSH session 里用无害的 exit-2 deny canary 验证。当前 DSH 会记录但不会执行 `{"continue":false}`；Windows PowerShell 还可能吞掉原生子进程的 exit 2。详细限制与 canary 步骤见[兼容性表](./compat.md#verify-hook-enforcement-after-moving)。

`doctor --live` 需要 `DSH_HOME/profiles` 下已有可见的运行时；DSH `0.1.2-rc.1` 在第一次正常启动 Web 时创建这些链接，单独 dump 不会创建。缺少时检查会停止，不会自动下载或启动迁移配置。它仅为隔离的官方基线处理一次跳转到同源 `/` 的登录响应，临时 cookie 只留在内存中用于 HTML 和 JavaScript 检查，不写盘、不输出，也不跟随其他跳转。

技能目录按 session 固定，所以搬完后请新建 DSH session。

## Claude Code 双栖

DSH 原生技能可以搬回 Claude Code。从 Claude Code 搬来的资产会识别并跳过。

```sh
npx dsh-movein --reverse
npx dsh-movein --reverse --apply
```

反向搬家目前只支持 Claude Code。

## Claude Code 到 OpenCode

需要完整 Claude Code 到 OpenCode 搬家路径的用户仍可使用兼容命令。

```sh
npx claude-to-opencode
npx claude-to-opencode --apply
```

如果只需要在 OpenCode 中运行 Claude Code 命令型 hooks，请使用独立的 [opencode-claude-code-hooks](https://github.com/sjh9714/opencode-claude-code-hooks) plugin。

## 不搬内容

- sessions
- OpenCode permissions 和 plugins
- Codex approval 与 sandbox policy
- 多个 instruction 文件、glob 和远程 URL
- 反向搬家时手写的 DSH MCP 与 hook 配置

会话历史请使用 [dsh-chat-import](https://github.com/Nwflower/dsh-chat-import)。配置与历史是两项独立操作，分别确认来源、目标和各自的限制；组合流程尚未联合验证，也不代表对方项目背书。

### Windows 启动问题先处理

如果 DSH 在 Windows 上无法启动 PowerShell，可以先用 [dsh-win32](https://github.com/sjh9714/dsh-win32) 诊断已知故障，并单独验收已安装的官方组件链。先解决 host 问题，再应用搬入。Movein 不会自动安装 dsh-win32；组件通过也不等于完整 Minimal 会话或 hook 强制执行通过。

## 项目状态

CLI 搬入路径保留 rc.6 与 rc.7 的回归覆盖。CI 还会把 release tarball 分别安装进 manifest 明确列出的每个 DSH 版本，验证安装、Web 启动和卸载。

## 许可

MIT
