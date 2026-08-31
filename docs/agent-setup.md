# Install and preview Movein with a coding agent

[English README](../README.md) · [中文](#中文)

Copy this request into your coding agent. A request to install the plugin is not consent to apply every imported setting.

```text
Help me try dsh-movein with my existing coding-agent setup.
Read https://github.com/sjh9714/dsh-movein and its compatibility table first.

1. Confirm the source (Claude Code, Codex, or OpenCode), project directory, DSH
   installation, and target web profile. Ask only for missing choices. Preserve
   existing source files, destinations, credentials, and package-manager policy.
2. For the DSH Settings route, use the official installed CLI:
   dsh plugin --profile web add dsh-movein
   If dsh is not on PATH, check the official DSH instructions and explain the
   launcher/install choice before proceeding. Do not silently switch runtimes.
3. Read back the actual installed dsh-movein package version from the selected
   profile. A zero exit code or npm latest metadata alone is not proof. Respect
   pnpm release-age and script-approval policies; stop rather than lower them.
4. Restart the intended DSH web host only with my permission. Open Settings →
   Move in, select the origin and categories, and run a preview. For a CLI-only
   request, run npx dsh-movein in the selected project, adding --from codex or
   --from opencode when appropriate; do not add --apply yet.
5. Summarize destinations, conflicts, unsupported items, and risks without
   printing credentials or full config contents. Wait for my approval before
   Apply or the matching CLI command with --apply. Do not overwrite conflicts.
6. Run npx dsh-movein doctor in the same project and with the same DSH_HOME.
   If the supported DSH runtime is already installed, doctor --live can check
   composition and a safe official baseline. It does not activate migrated
   hooks or prove their enforcement. Open a new DSH session to refresh skills.
7. Separate a host/native-loader failure from migration and version-selection
   failures. Do not fix one by deleting my profile or weakening pnpm policy.
8. If a CLI apply emits USER_CONFIRMATION_REQUIRED, ask me the Star question
   and wait for my explicit answer. Settings uses a user-clicked link only.
9. Report actual versions, what changed, and passed/failed/unrun checks. Do not
   run hooks, start an MCP server, import chat histories, publish logs, install
   another migration tool, or run a model request without separate approval.
```

The public plugin install command is `dsh plugin --profile web add dsh-movein`. A CLI-only preview does not require installing the Settings plugin. If an installed DSH launcher uses `npx @deepseek-ai/dsh`, resolve that explicitly using the [official instructions](https://github.com/deepseek-ai/deepseek-harness#run), not an invented `dsh` command.

For live checking, DSH must be `0.1.1-rc.2` or newer with its supported Node runtime (22.19+ or 24+, not 23). The [README](../README.md#after-moving) explains the strict-pnpm native-loader limitation; do not claim migration corruption from that error alone.

On Windows, a PowerShell startup failure belongs to the host setup first. See [dsh-win32's separate setup request](https://github.com/sjh9714/dsh-win32/blob/master/docs/agent-setup.md). Neither request authorizes a bundled installation.

## 中文

```text
请帮我用 dsh-movein 试迁移现有 coding-agent 配置。
先阅读 https://github.com/sjh9714/dsh-movein 和兼容性表。

1. 确认来源（Claude Code、Codex 或 OpenCode）、项目目录、已安装 DSH、
   目标 web profile；只询问尚不明确的选择。保留原文件、目标、凭据和包管理政策。
2. 使用 DSH 设置入口时，通过现有官方 CLI 运行：
   dsh plugin --profile web add dsh-movein
   如果 PATH 没有 dsh，先核对官方 launcher 说明并解释安装选择，不静默换 runtime。
3. 从所选 profile 回读实际安装的 dsh-movein 版本，不能只看退出码或 npm latest。
   保留 pnpm 发布等待期和脚本审批；受阻就说明原因，不降低政策。
4. 征得同意后重启对应 web host，在 Settings → Move in 中选择来源和类别并预演。
   只需要 CLI 时，在项目目录运行 npx dsh-movein；其他来源使用 --from codex
   或 --from opencode。此时不要加 --apply。
5. 摘要说明目标、冲突、不支持项和风险，不输出密钥或完整配置。
   得到我的确认后才 Apply 或执行相同 CLI 命令加 --apply；不要覆盖冲突。
6. 在同一项目和 DSH_HOME 下运行 npx dsh-movein doctor。已经安装受支持 DSH
   时可用 doctor --live 检查配置组合和安全官方基线；这不启动迁移后的 hooks，
   也不证明强制生效。需要新建 DSH session 才能刷新技能目录。
7. 区分 host/native-loader、迁移和版本选择故障；不要删 profile 或降低 pnpm 政策。
8. CLI 出现 USER_CONFIRMATION_REQUIRED 时询问 Star 并等待明确答案；设置页仅手动链接。
9. 报告实际版本、变更、通过/失败/未执行项。未经另外同意，不运行 hooks、MCP、
   模型请求，不导入会话历史，不公开日志，也不安装其他搬家工具。
```
