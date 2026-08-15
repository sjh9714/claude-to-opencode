# juejin 2탄

标题：Claude Code 资产在 DSH 里的真实兼容性对照表，附每请求 token 账单

正文：

上一篇介绍了搬家工具 dsh-movein，这一篇把工具背后的调研独立发出来：Claude Code 的每类资产在 DeepSeek Harness 里到底会怎样，全部按 0.1.0-rc.6 源码逐项实测，不是猜的。另外附一份很多人没算过的账：你搬进去的技能，每个请求要花多少 token。

## 兼容性对照表

| Claude Code 资产 | DSH 兼容性 | 实际情况 |
| --- | --- | --- |
| 项目 CLAUDE.md | 原生，零改动 | instructionFileCandidates 默认含 CLAUDE.md，从项目根到 cwd 自动发现 |
| 全局 ~/.claude/CLAUDE.md | 一个符号链接 | 全局位只认 $DSH_HOME/AGENTS.md，链过去即可 |
| 技能 SKILL.md | 格式原样兼容 | 前置元数据按开放对象解析，未知键忽略；但 .claude/skills 不是默认技能根，要落到 ~/.dsh/skills |
| .mcp.json | 无损机械转换 | 每个服务器一行 dsh-mcp-client 配置，工具名 mcp__server__tool 两边完全一致 |
| hooks | 官方桥，部分事件 | dsh-hooks-claude-code 原样跑现有配置，30 个事件映射 7 个，仅 command 型 |
| 权限规则 | 非原生，可桥接 | deny/ask 可在 tools/pre-execute 强制执行；allow 无对应物，实测某竞品的 allow 也只是记录后放行 |
| 子代理 .claude/agents | 无法直接导入 | DSH 预设是 agent.cordis.yml 目录，现实路径是转成技能 |
| 会话 | 最难，别碰 | v0 格式无兼容承诺，zstd 帧 + 严格事件校验，历史请用 dsh-chat-import |

## 三个会咬人的坑

1. cordis.patch.yml 里引用 profile 解析不到的包，dsh 直接启动失败（fatal，不是警告）。
2. 周边包 npm latest 标签落后于核心（hooks 桥 rc.5 vs 核心 rc.6），安装要按宿主版本锁定。
3. dsh-hook-protocol 是 hooks 桥的 peer 依赖，宿主不带，要一起装。

## 每请求的 token 账单

技能目录以 system-reminder 注入每个请求，格式逐字取自源码复现后分词（o200k 近似）：

| 目录里的技能数 | 每请求 token |
| --- | --- |
| 0 | 143 |
| 20 | 703 |
| 40 | 1263 |
| 129 | 3755 |

固定包装 143 token，每个技能约 28 token（96 字符描述计）。129 是橙皮书开机日志里的插件数，这个规模的配置每个请求背 3.8k token。缓存省钱，省不了上下文窗口。

结论：搬家前先精简，搬你用的技能，不是你有的技能。描述就是每请求的账单，写短点。

## 工具

以上全部自动化在 dsh-movein 里（v0.4 起支持 --reverse 反向搬回，双栖不二选）：

```sh
npx dsh-movein            # 预演清单
npx dsh-movein --apply    # 搬进 DSH
npx dsh-movein --reverse  # DSH 里长出来的技能搬回 Claude Code
```

仓库 https://github.com/sjh9714/dsh-movein （对照表和 token 脚本都在 docs/ 里，可复现）
