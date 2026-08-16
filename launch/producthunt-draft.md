# Product Hunt 초안 (dsh-movein)

Name. dsh-movein

Tagline. Move your whole Claude Code setup into DeepSeek Harness

Links. https://github.com/sjh9714/dsh-movein · https://www.npmjs.com/package/dsh-movein

Topics. Developer Tools, Open Source, Artificial Intelligence

Description.
DeepSeek Harness (DSH) is the fastest growing open source agent harness right now, and most people trying it come from Claude Code. Your setup should come with you. One command moves skills, MCP servers, hooks, subagents and permission rules. CLAUDE.md needs no move at all, DSH reads it natively. Dry run by default with a moving estimate, a migration diff report for permission rules (never silent), and idempotent re-runs. Install as a DSH plugin and the agent can even do the move for you.

First comment (maker). (v0.5 반영, 런칭 당일 이 버전 게시)
I shipped this three days into the DSH gold rush after realizing half the migration is already free, DSH reads CLAUDE.md natively and loads Claude Code SKILL.md files unchanged. The tool handles the mechanical rest and refuses to fail open, every permission rule that cannot map is listed in a diff report instead of being dropped silently.

Since then it grew the parts people asked for. Slash commands convert to skills, cordis.patch.yml is backed up before every write with a one-command restore, and yesterday's v0.5.0 added a doctor command that verifies the move afterwards, including a frontmatter shape that makes a skill silently vanish from DSH's catalog (we wrote up the exact mechanism in the repo).

Happy to answer anything about the DSH plugin model, it is a fun architecture (everything is a plugin, literally).

## ⚠ 런칭일 버전 주의 (8/17)
pnpm 11 기본 24시간 쿨다운 때문에 `dsh plugin add dsh-movein`은 런칭 시각(16:00 KST)엔 0.4.0이 설치됨. 0.5.0은 19:49 KST부터 plugin add로 잡힘. `npx dsh-movein`은 npm 경로라 즉시 0.5.0. 댓글에서 doctor 시연 안내할 땐 npx 커맨드로 안내할 것. 그리고 런칭 전날/당일 새 버전 발행 금지 (발행해도 24시간 동안 plugin add에 안 잡힘).

## 예상 질문 카드 (런칭일 대응용)

Q. 세션/대화 기록도 옮겨지나
A. Out of scope on purpose. DSH has no import API and no compat promise on its session format, so writing session files risks breaking your install. For conversation history use dsh-chat-import, we link it in the README, the two tools complement each other.

Q. Codex나 다른 CLI에서도 되나
A. Next on the roadmap (issue #3). The moving machinery (symlinks, patch rows, manifest) is source-agnostic, only the scanner is Claude Code specific today. Tell us what your setup looks like on the issue, that decides scanner order.

Q. 안전한가 / 뭘 덮어쓰나
A. Dry run is the default and shows every planned change first. Applies back up cordis.patch.yml beforehand, restore brings it back. Every move is logged to a manifest. Zero dependencies, small enough to audit before running.

Q. Claude Code를 버려야 하나
A. No. Skills are symlinked so both sides stay current, and --reverse brings DSH-born skills back. Dual boot is a supported workflow, not a compromise.

첨부. docs/demo.gif (갤러리 1번), report.png, social.png (갤러리 3장 업로드 완료)
