# Console.dev 제보 메일 초안

To. hello@console.dev
Subject. Tool submission, dsh-movein (Claude Code to DeepSeek Harness migration)

Hi,

Submitting a tool for consideration. dsh-movein moves a whole Claude Code setup into DeepSeek Harness (the agent harness DeepSeek open sourced this week, 97k stars in three days) with one command. Skills, MCP servers, hooks, subagents and permission rules all carry over, CLAUDE.md needs no move because DSH reads it natively. Dry run by default with a moving estimate report, a migration diff for permission rules that refuses to fail open, and idempotent re-runs. Zero dependency Node CLI, MIT, also installable as a DSH plugin so the agent can run the migration itself.

Repo. https://github.com/sjh9714/dsh-movein
npm. https://www.npmjs.com/package/dsh-movein
Demo GIF. https://raw.githubusercontent.com/sjh9714/dsh-movein/main/docs/demo.gif

Thanks,
Jinhyuk
