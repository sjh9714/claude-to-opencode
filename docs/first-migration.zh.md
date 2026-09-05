# Claude Code 配置搬到 DSH：先预演，保留已有文件

[English README](../README.md) · [中文 README](./README.zh.md) · [给 coding agent 的指令](./agent-setup.md#中文)

想试 DSH，但不想重新整理 Claude Code 的技能和配置？先看搬家清单，再决定应用哪些变化。dsh-movein 的默认操作是预演，不会因为扫描到了文件就直接写入。

我维护 dsh-movein 和 dsh-win32。本文只展示可复现的文件迁移，不承诺所有 hooks、权限规则或完整 DSH 会话等价。

## 先看一个不会接触你配置的例子

仓库提供[可执行的合成数据示例](../demo/verify-first-migration.mjs)。它调用与产品相同的扫描、规划和应用引擎，在临时目录中真正复制文件并检查结果，不是手写“成功”输出。

它特意放入两类已有目标：一份全局 instruction 和一个同名 skill。预期是保留它们，只搬入另外两个技能。项目里的 `CLAUDE.md` 保留在原地，因为 DSH 原生读取它。合成来源 transcript 和目标会话占位文件也必须原样保留；它们不是完整 DSH 会话。

在没有同名目录的位置克隆仓库，再运行：

```sh
git clone https://github.com/sjh9714/dsh-movein.git
cd dsh-movein
npm ci
node demo/verify-first-migration.mjs
```

`npm ci` 会安装仓库开发依赖；演示脚本本身不下载 DSH、不访问模型、不安装插件、不执行 hook、不操作 GitHub。它显式指定合成来源与目标，不使用你的 Claude 或 DSH profile。

成功运行会得到下面的检查结果；任何断言失败都会以非零退出码结束：

```text
1. 预演：2 个待搬技能，2 个已有目标保留；没有写入。
2. 应用：2 个技能内容逐字节一致；已有目标和来源文件未改动。
3. 再预演：0 个待搬项目；没有重复写入。
4. 来源技能改变后再应用：已有副本不覆盖；会话占位文件未改动。
5. 恢复：只还原 cordis.patch.yml；技能、清单、来源和会话占位文件保留。
清理：仅删除本次创建的临时目录。
```

这是迁移引擎的合成数据实跑，不是 Windows 录屏，也不是 DSH Settings、插件安装或完整模型会话验收。CI 会在 Linux、Windows 和 macOS 重跑这个例子；具体结果以该提交的 [Actions](https://github.com/sjh9714/dsh-movein/actions) 为准。

## 再试自己的项目：预演与应用分开

在要搬入的项目目录中运行：

```sh
npx dsh-movein
```

检查来源、目标、冲突和不支持项。不要公开完整预演输出，它可能包含私人路径或配置。只有确认这些变化后，才运行：

```sh
npx dsh-movein --apply
npx dsh-movein doctor
```

已有目标会跳过，而不是覆盖。需要复制 skills 而不是创建符号链接时，在预演和应用两次命令中都加 `--copy`。这不代表所有资产都会改用复制，也不代表全部配置可无损迁移。

Codex 使用 `--from codex`，OpenCode 使用 `--from opencode`。具体哪些内容能搬、哪些仅提示而不转换，见[兼容性表](./compat.md)。

## 更喜欢设置页？

使用你已安装的官方 DSH CLI：

```sh
dsh plugin --profile web add dsh-movein
```

确认 profile 中实际安装的版本，再重启对应 `dsh web`，打开 **Settings → Move in**。选择类别、预演、查看冲突，再应用。PATH 中没有 `dsh` 时，先按 [DSH 官方说明](https://github.com/deepseek-ai/deepseek-harness#run) 确认 launcher；不要在不知情时切换到另一套 DSH。

![来自真实 DSH 运行的预演与应用截图](./settings-demo.gif)

上图来自 macOS 上 DSH `0.1.2-rc.1` 与 dsh-movein `0.13.8` 的真实设置页录屏，展示合成技能的预览与应用；未运行模型任务。应用后可按[第一次任务指南](./first-task.md#中文)另行验证实际使用。`doctor --live` 检查配置组合及安全的官方基线，不启动迁移后的 hooks，也不证明它们能阻止危险操作。

如果 pnpm 的发布等待期导致安装到较早版本，保留政策并稍后重试；不要降低 `minimumReleaseAge`。native-loader 故障与版本选择是不同问题，参见 [README 中的已知边界](../README.md#after-moving)。

## Windows 与会话历史：分开选择

- Windows 上 PowerShell 不能启动时，先看 [dsh-win32 排错指南](https://github.com/sjh9714/dsh-win32/blob/master/docs/windows-first-run.zh.md)，解决 host 问题后再搬配置。
- 想继续以前的对话时，[dsh-chat-import](https://github.com/Nwflower/dsh-chat-import) 负责会话历史；Movein 负责配置。只需要设置或只需要历史的用户不必安装两个工具。

两个项目的组合流程尚未联合验证，也未获得对方背书。先分别检查来源、目标、重复导入与回滚边界，不启用未验证的自动同步。这份文档不是联合安装脚本。

### 重复导入不是覆盖，也不是完整回滚

需要历史时，先用 dsh-chat-import 的面板、`scan_discover` 或 `preview: true` 检查所选来源；确认后单独导入，逐条检查返回的 `status`，最后运行它的 `doctor`。不要因为 Movein 已经成功就跳过历史侧检查。

以下边界限于默认追加式导入（不启用 `replace` 或自动同步），由[对方维护者确认](https://github.com/Nwflower/dsh-chat-import/discussions/32#discussioncomment-18217949)，对应源码版本为 [`f457adb`](https://github.com/Nwflower/dsh-chat-import/tree/f457adb3fc0510761e2c08fb3c99f77ec7c61cc6)：

| 操作或来源变化 | 预期结果 |
| --- | --- |
| 来源未变，再次导入 | `already-imported`，不重复写入 |
| 来源增加新轮次 | `appended`，追加到同一会话，保留已导入历史 |
| 来源轮次减少 | 报告 `sourceShrunk`，不截断目标 |
| 相同轮次内修改内容 | 可能报告 `changedInPlace` 并跳过，不应当作更新已导入历史的方式 |
| 显式 `force: true` | 新后缀 ID 保存完整副本，旧会话保留；不是覆盖开关 |
| 撤回并删除工件后遇到宿主残留 ID | 报告 `staleGhost`，以新后缀 ID 重新导入 |

显式 `replace: true` 是另一条路径，不在上述保留约定内：该版本测试包含 Cursor 导入在同一 ID 下替换、返回 `replaced` 的行为。本文不启用它；不要把 `force` 和 `replace` 当成同一个选项。

恢复范围也必须分开：

- **Movein `restore`**：只恢复最新备份的 `cordis.patch.yml`，不删除已搬技能，不撤回历史导入，也不是全目录回滚。上面的复制示例还检查：来源技能后来改变时，再次应用不会覆盖已有副本；符号链接不适用这个副本结论。
- **dsh-chat-import `retract_import`**：只移除导入登记记录并返回手动删除指引，**不会删除会话工件**。返回 `removed: true` 不代表会话文件已删除。
- **dsh-chat-import 面板「历史」页**：确认后可删除该插件登记创建的会话；这是独立的删除操作，目前使用官方 delete API 之外的维护路径。先确认准确会话和备份需求，不要把它当作只读撤回。
- **幽灵会话**：即使工件已删，宿主列表仍可能在重启前显示旧 ID；列表残留不等于导入又写了一份。
- **两边的 doctor**：各自检查自己的状态；dsh-chat-import 的 `doctor` 只读，不导入、同步或删除文件。任一方体检成功都不代表完整组合流程通过。

维护者已完成互链，但互链不构成相互背书。英文[独立检查与测试边界](./session-import-boundaries.md)列出了可复核的合成测试来源；这些测试不会将两套插件装进同一个真实 DSH 会话。

## 试完后，什么反馈最有用？

告诉我们来源工具、版本、预演中缺了哪类资产，或哪个冲突仍需手工处理即可。请用合成文件提交[最小复现](https://github.com/sjh9714/dsh-movein/issues)，不要上传真实会话、密钥或完整配置。

如果实际节省了配置时间，欢迎自愿 [Star dsh-movein](https://github.com/sjh9714/dsh-movein)。不 Star 也能使用全部功能并获得同样的帮助。
