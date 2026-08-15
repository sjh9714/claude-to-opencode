# Product Hunt 초안 (dsh-movein)

Name. dsh-movein

Tagline. Move your whole Claude Code setup into DeepSeek Harness

Links. https://github.com/sjh9714/dsh-movein · https://www.npmjs.com/package/dsh-movein

Topics. Developer Tools, Open Source, Artificial Intelligence

Description.
DeepSeek Harness (DSH) is the fastest growing open source agent harness right now, and most people trying it come from Claude Code. Your setup should come with you. One command moves skills, MCP servers, hooks, subagents and permission rules. CLAUDE.md needs no move at all, DSH reads it natively. Dry run by default with a moving estimate, a migration diff report for permission rules (never silent), and idempotent re-runs. Install as a DSH plugin and the agent can even do the move for you.

First comment (maker).
I shipped this three days into the DSH gold rush after realizing half the migration is already free, DSH reads CLAUDE.md natively and loads Claude Code SKILL.md files unchanged. The tool handles the mechanical rest and refuses to fail open, every permission rule that cannot map is listed in a diff report instead of being dropped silently. Happy to answer anything about the DSH plugin model, it is a fun architecture (everything is a plugin, literally).

첨부. docs/demo.gif (갤러리 1번), 스크린샷은 dry run 리포트 터미널 캡처 추가 예정
