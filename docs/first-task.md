# Try DSH with one familiar part of your setup

[README](../README.md) · [中文](#中文)

You can keep using Claude Code while trying its skills in DSH. Start with one category, check the imported result, and add MCP or other configuration later when you need it.

## Preview and apply

Use your existing DSH installation and its intended Web profile:

```sh
dsh plugin --profile web add dsh-movein
```

Check the installed package version and restart the intended Web host. If `dsh` is not on `PATH`, use the [official launch instructions](https://github.com/deepseek-ai/deepseek-harness#run). Keep package-manager release-age and script-approval settings in place.

1. Open **Settings → Move in** and enter the project folder. The preview gate and initial selection described here are available in 0.13.8+.
2. Start with **Skills**. The category includes all discovered skills, so read every row in the preview; there is no per-file selector. Codex imports different assets and starts with **Instructions** instead.
3. Select **Preview changes**. Check sources, existing destinations, and unsupported entries. Changing the folder, origin, or categories clears the preview.
4. Select **Apply selected** only when those changes are what you want. Existing destinations are skipped. Keep your source setup available.

If the selected category finds nothing, do not count that as an import. Check the source folder and the [origin compatibility table](./compat.md). CLI and model-tool defaults are unchanged; this skills-first selection belongs to Settings.

## Use the result

Open a **new DSH session in the same project**. Choose a small task suited to one imported skill. For example, if your skill reviews documentation:

```text
Load the <imported-skill-name> skill and use it to review README.md.
Give me three concrete improvements. Do not edit files or run shell commands.
If you cannot load the skill, tell me instead of reviewing without it.
```

Replace the name with an actual imported skill. Check the skill-load result and whether the answer follows its instructions. An ordinary answer without loading the skill is not evidence that the migration worked.

For **Codex instructions**, use a small task with an observable instruction from the imported `AGENTS.md`, such as the required response language or review format. That verifies only the instruction you observed; Codex skills, approval policy, and sandbox policy are outside this import path.

A model-backed task uses the provider already configured in DSH and may incur its normal usage cost. Import does not configure a model account. If there is no provider, stop at the imported-files result and mark the task **not run**.

MCP servers and hooks can run programs. Review those categories separately before enabling or invoking them. A migrated hook is not proof of equivalent enforcement; see the [documented limits](./compat.md#verify-hook-enforcement-after-moving).

## Tell us what happened

We are looking for five first-run testers. [Share a short result](https://github.com/sjh9714/dsh-movein/issues/new?template=first-run.md): origin and versions, the task you wanted, and the furthest step completed. Both successes and blocked attempts help us decide what to improve.

Keep private paths, configuration files, credentials, and conversation history out of the issue. A synthetic example is enough. `restore` restores only the patch backup; it does not remove imported skills or roll back a whole profile.

## 中文

你可以继续用 Claude Code，同时在 DSH 中试用已有技能。

1. 用现有官方 CLI 安装 `dsh plugin --profile web add dsh-movein`，核对实际版本后重启对应 Web host。保留包管理器的发布等待期与脚本审批设置。
2. 在 **Settings → Move in** 输入项目目录。先选择技能；Codex 的来源范围不同，默认先选择指令。
3. 预览会列出该类别发现的所有项目，没有逐文件选择器。检查每一项再应用；更改目录、来源或类别后需要重新预览。已有目标会跳过。
4. 在同一项目中新建 DSH 会话，让它加载一个真实迁入的技能并完成适合该技能的小任务。例如让文档审阅技能检查 README，提出三项改进，不修改文件或运行命令。
5. 核对技能加载结果与回答是否遵循技能指令。Codex 指令则核对一个可观察规则，例如语言或审阅格式；这不验证 Codex skills、approval 或 sandbox policy。

模型任务使用你已配置的 DSH provider，可能产生正常用量费用。没有 provider 时，停在文件迁入结果并标记任务“未运行”。MCP 与 hooks 另行审查；不要把导入成功当作强制执行等价。

我们正在寻找五位首次试用者。请[反馈来源、版本、目标和完成到哪一步](https://github.com/sjh9714/dsh-movein/issues/new?template=first-run.md)。卡住也有用，不要上传路径、完整配置、密钥或会话。`restore` 只恢复 patch 备份，不是整个 profile 回滚。
