# 라운드 3 대외 게시 초안 (승인 대기)

## 1. 디스커션 #838 답글 (「设置页导入 Claude Code 配置」 요청 스레드)

> 现在就能用上的版本，装一个插件，然后在对话里说「把我的 Claude Code 配置搬过来」。
>
> ```sh
> dsh plugin --profile web add dsh-movein
> ```
>
> 插件注册了 `movein_from_claude_code` 工具，agent 会先出一份搬家清单（dry run），确认后落地。搬的范围是技能、MCP、hooks、子代理和权限规则，项目里的 CLAUDE.md 不用搬，DSH 原生就读。不想装插件的话 `npx dsh-movein` 也一样。
>
> 说下限制。这是对话入口，不是你说的设置页按钮，设置页 UI 我还没做，权限规则里 allow 也没法映射（差异报告会列出来）。如果官方要做原生入口，对照表和坑都在 https://github.com/sjh9714/dsh-movein/blob/main/docs/compat.md ，随便拿去用。

## 2. 디스커션 #1359 답글 (pi/opencode/codex/claude-code 임포트 아이디어)

> 会话之外的那半（配置、技能、MCP、hooks、子代理、权限规则），Claude Code 这个来源已经能搬了，dsh-movein 一条命令，默认先出预演清单。会话历史那半 dsh-chat-import 做得更全（13 个来源）。
>
> codex / opencode / pi 作为来源，正好是我们排的下一步（https://github.com/sjh9714/dsh-movein/issues/3 ）。搬运的部分（符号链接技能、生成 patch 行、manifest）是来源无关的，缺的只是各家的扫描器。如果你在用其中一个，能不能在 issue 里说下你的配置里都有什么（技能格式、MCP 配置文件位置），这决定扫描器的实现顺序。

## 3. HelloGitHub 제출 (submit-cn 폼, 8/28호)

- 项目地址. https://github.com/sjh9714/dsh-movein
- 类别. JavaScript
- 项目标题. 一条命令把 Claude Code 配置整套搬进 DeepSeek Harness
- 项目描述. 从 Claude Code 迁到 DeepSeek Harness 时，积累的技能、MCP 服务器、hooks、子代理和权限规则不用重建。dsh-movein 扫描本机 Claude Code 资产，先出一份「搬家清单」预演，确认后一条命令全部搬完。权限规则会输出迁移差异报告，无法映射的规则逐条列出而不是静默丢弃。v0.4 起支持反向搬家，DSH 里长出来的技能可以搬回 Claude Code，两个工具双栖使用。零依赖 Node CLI，MIT 协议。
- 亮点. 搬家前先算账，仓库里附一份按源码逐项实测的资产兼容性对照表，以及「每个技能每请求 28 token」的目录成本实测，搬你用的技能而不是你有的技能。
- 截图. https://raw.githubusercontent.com/sjh9714/dsh-movein/main/docs/demo.gif

## 4. GitHubDaily 이슈 (수시 접수)

- 标题. 推荐 dsh-movein，一条命令把 Claude Code 配置搬进 DeepSeek Harness
- 内容. DeepSeek Harness 本周爆火，大量用户从 Claude Code 迁移。dsh-movein 把技能、MCP、hooks、子代理、权限规则一条命令搬完，默认 dry run 出搬家清单，权限规则带迁移差异报告，v0.4 支持反向搬回实现双栖。仓库附实测兼容性对照表与 token 成本账单，均可复现。https://github.com/sjh9714/dsh-movein

## 5. ruanyf/weekly 자천 (타이밍 주의)

주의. dsh-win32 자천이 오늘 아침(8/16) 같은 계정 흐름으로 이미 올라가 있음. 같은 호에 동일 저자 2건은 눈에 띄므로 **다음 주 초(8/24 월) 제출 권고**. 초안은 준비 완료.

- 标题. 【开源自荐】dsh-movein，把 Claude Code 的整套配置一条命令搬进 DeepSeek Harness
- 内容. DeepSeek Harness 发布后大量用户从 Claude Code 迁移，但积累的技能、MCP、hooks、权限规则没人想重建。dsh-movein 先出搬家清单预演，确认后一条命令搬完，权限规则输出迁移差异报告（几条生效、几条映射不了都列出来）。v0.4 起支持反向搬家实现双栖。仓库里附两份实测资料，按 rc.6 源码逐项验证的资产兼容性对照表，和技能目录「每技能每请求 28 token」的成本实测，脚本可复现。零依赖，MIT。https://github.com/sjh9714/dsh-movein

## 6. PerryLink/dsh-permission-rules 이슈 (표준 상호운용 제안)

- Title. Proposal, shared rule-syntax test vectors between our two gates
- Body.
> We both compile Claude Code style permission rules onto the tools/pre-execute waterfall (your dsh-permission-rules with ordered allow/deny/ask and path matching, my dsh-movein-permissions with the migration-oriented deny/ask subset). Users are already mixing the two ecosystems, so identical rule strings silently meaning different things between gates would be the worst outcome for everyone.
>
> Proposal, a tiny shared test-vector file (JSON, rule string + tool name + arguments + expected match boolean) that both repos run in CI. I checked your runtime.ts and we already disagree on one point worth pinning down, your allow is an audited passthrough to next() while mine does not implement allow at all, and both behaviors deserve an explicit vector rather than folklore. I will write the first draft set (20 or so vectors covering prefix :*, globs, mcp__ exact names, workspace paths) if you are open to it, hosted wherever you prefer.
>
> Reference measurements on my side, https://github.com/sjh9714/dsh-movein/blob/main/docs/compat.md

## 7. dshbase (ylwl1997/dshbase) 링크 댓글

접수 이슈 확인 후 제출 예정. 형식은 저자 안내를 따름.
