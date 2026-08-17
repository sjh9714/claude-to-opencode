# EN 채널 초안 (승인 대기, 건별 게시)

HN은 사용자 지시로 정지. 아래는 Reddit 답글 2건과 유튜버 피치 4통.
r/PiCodingAgent 스레드는 제외했음. pi 오리진을 아직 안 만들어서 정직하게 답할 게 없음.

## 1. Reddit 답글 A — r/DeepSeek "My First Impressions of Deepseek Harness" (95pt)

맥락. 스킬이 자동으로 안 붙고 셋업이 헷갈린다는 불만.

> The skills part tripped me up too, so in case it saves you time. DSH only scans two skill roots by default, `~/.dsh/skills` (global) and `<project>/.dsh/skills`, and the catalog is snapshotted per session, so anything you add mid-session stays invisible until you open a new one. Two other silent traps I hit, a `description:` with an unquoted ": " inside makes DSH's YAML parser drop the whole skill with no log line, and symlinked directories work fine (the scanner follows them).
>
> Disclosure, I ended up building a tool around exactly this, dsh-movein migrates a whole Claude Code setup into those roots (skills, MCP, hooks, slash commands, permission rules) with a dry run first, and its doctor command flags the silent-drop frontmatter shape. MIT, zero deps. https://github.com/sjh9714/dsh-movein
>
> Even if you don't want the tool, the compat table in docs/compat.md documents what every Claude Code asset does in DSH, measured against the source. That part is just reference material.

## 2. Reddit 답글 B — r/DeepSeek "Has anyone tried DSH?" (15pt/28c, 활성)

맥락. 경험담을 묻는 오픈 스레드.

> Been running it since launch day, coming from Claude Code, with both still installed. Field notes from migrating a real setup rather than a fresh install.
>
> What carried over cleanly, project CLAUDE.md (DSH reads it natively, zero work), SKILL.md files (format compatible as is), MCP servers (tool names are literally identical, `mcp__server__tool`). What partially carried, hooks (the official bridge maps 7 of Claude Code's 30 events and only runs command-type hooks, everything else silently never fires) and permission rules (deny/ask enforceable, allow has no DSH equivalent). What I left behind, sessions (v0 format, no compat promise).
>
> One cost note since people ask, the skill catalog is injected into every request, roughly 28 tokens per skill. Migrate the skills you use, not everything you have.
>
> Disclosure, I automated all of this into dsh-movein (dry run by default, migration diff report). Repo has the full measured compat table if you want the reference without the tool. https://github.com/sjh9714/dsh-movein

## 3. 유튜버 피치 (이메일 또는 영상 댓글 1개, 채널당 1회)

### MG (33.7K subs, "DeepSeek Harness Setup: Free Claude Code in 10 Minutes", 17K views)

> Loved the setup video, one segment idea for a follow-up. Your walkthrough starts from a fresh install, but a big share of people trying DSH right now come from Claude Code with months of accumulated skills, MCP servers and hooks. There's a one-command path for them, `npx dsh-movein` prints a moving estimate of everything it found, `--apply` moves it in, and a doctor command verifies the result. I built it, MIT, zero deps, demo GIF here, https://github.com/sjh9714/dsh-movein. Happy to answer anything if you cover the migration angle, including what does NOT map (hooks only bridge 7 of 30 events, that table is in the repo).

### NeuralNine (481K subs, "The End of Claude Code?", 150K views)

> Great breakdown. If you do a follow-up, the unanswered question in your comments is "do I have to rebuild my Claude Code setup?" The answer is mostly no, DSH reads CLAUDE.md natively and loads Claude Code SKILL.md files unchanged, and the mechanical rest (MCP, hooks, subagents, permission rules) is a one-command migration with dsh-movein. I built it and documented what every asset type actually does in DSH, measured against the source, https://github.com/sjh9714/dsh-movein/blob/main/docs/compat.md. The honest limits table tends to make better content than the happy path.

### Income Stream Surfers (151K subs)

> Your DSH + V4 Flash video asks whether it ends Claude Code. For viewers who want to try DSH without burning their existing Claude Code setup, there's a one-command migration (and a reverse mode to go back, so it's a dual-boot, not a divorce), https://github.com/sjh9714/dsh-movein. One command in your next video saves your viewers an afternoon.

### Prism Labs (3.9K subs, launch-day coverage)

> You covered DSH on day one. Day-five story that nobody has filmed yet, moving an existing Claude Code setup in (skills, MCP, hooks, permissions) and what silently breaks if you do it by hand, e.g. a skill description with an unquoted colon vanishes from DSH's catalog with no error. Tool plus the measured writeups, https://github.com/sjh9714/dsh-movein. Small channel to small channel, happy to give you anything you need for the segment.
