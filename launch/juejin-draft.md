# juejin 文章草稿

标题：从 Claude Code 拎包入住 DeepSeek Harness，一条命令搬完整套配置

正文：

DSH 发布三天，很多人是从 Claude Code 过来试水的。工具可以换，但积累下来的配置换不动：CLAUDE.md 里的规则、一堆 SKILL.md、MCP 服务器、hooks、子代理、权限规则。我写了个搬家工具 dsh-movein，一条命令全带走。

![demo](https://raw.githubusercontent.com/sjh9714/dsh-movein/main/docs/demo.gif)

```sh
npx dsh-movein            # 预演，先看搬家清单
npx dsh-movein --apply    # 正式入住
```

## 能搬什么

| 资产 | 怎么搬 |
| --- | --- |
| 项目 CLAUDE.md | 不用搬。DSH 的 instructionFileCandidates 默认就含 CLAUDE.md |
| 全局 ~/.claude/CLAUDE.md | 链接为 ~/.dsh/AGENTS.md |
| 技能 | 符号链接进 DSH 技能根。SKILL.md 前置元数据按开放对象解析，Claude Code 的技能原样可用 |
| .mcp.json | 机械转换为 dsh-mcp-client 配置行，工具名 mcp__server__tool 两边完全一致 |
| hooks | 官方 dsh-hooks-claude-code 桥直接跑你现有的 hooks 配置 |
| 子代理 | 转换为 DSH 技能，系统提示词进技能正文 |
| 权限规则 | deny 与 ask 编译进配套插件，在 tools/pre-execute 强制执行 |

会话历史不搬，这块 dsh-chat-import 已经做得很好，互补使用。

## 踩过的三个坑

1. cordis.patch.yml 里引用了 profile 解析不到的包，dsh 直接启动失败（plugin tree failed to load），不是警告。所以工具先装包、装成功才写配置行。
2. 卫星包的 npm latest 标签落后于核心版本（hooks 桥是 rc.5 而 dsh 已经 rc.6），安装时按宿主 dsh 版本锁定。
3. dsh-hook-protocol 是 hooks 桥的 peer 依赖，宿主安装不带，要一起装。

默认 dry run，不加 --apply 不写任何文件。重复执行安全，生成块原地替换，自己的配置行不受影响。

仓库 https://github.com/sjh9714/dsh-movein
npm dsh-movein
