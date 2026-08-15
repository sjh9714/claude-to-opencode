# r/ChatGPTCoding 주간 자기홍보 스레드 댓글 초안

Made dsh-movein, a zero-dependency CLI that moves your whole Claude Code setup into DeepSeek Harness in one command. Skills load as is (same SKILL.md format), .mcp.json converts losslessly (tool names are identical on both sides), hooks run through DSH's own Claude Code bridge, subagents convert to skills, and permission deny/ask rules get enforced at DSH's tool gate with a migration diff report so nothing fails open silently. Dry run by default.

npx dsh-movein

https://github.com/sjh9714/dsh-movein
