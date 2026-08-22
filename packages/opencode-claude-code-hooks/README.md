# opencode-claude-code-hooks

Run existing Claude Code command guardrails in OpenCode without copying their commands or settings.

## Install

Add the package to the OpenCode plugin array.

```json
{
  "plugin": ["opencode-claude-code-hooks"]
}
```

OpenCode installs the package when it starts. The plugin reads these Claude files at every tool call.

- `~/.claude/settings.json`
- `<git-root>/.claude/settings.json`
- `<git-root>/.claude/settings.local.json`

## Preserved behavior

- `PreToolUse` and `PostToolUse` command hooks
- Claude matcher names such as `Bash`, `Edit`, and `Write`
- exit code 2 blocking
- structured deny results
- full `updatedInput` replacement
- post-tool feedback and `additionalContext`
- the Claude default command timeout of 600 seconds
- `CLAUDE_PROJECT_DIR` set to the Git project root

Settings are read at runtime, so editing a Claude hook does not require reinstalling this plugin.

## Honest limits

- `Stop` cannot preserve Claude timing with OpenCode's current stable plugin API
- prompt, agent, HTTP, async, and conditional `if` handlers stay manual
- allow and ask results do not bypass OpenCode permissions
- malformed source settings are ignored so they do not break OpenCode startup

For a dry-run report before installation, or to move memory, rules, commands, agents, and MCP config too, use [claude-to-opencode](https://github.com/sjh9714/claude-to-opencode).

```sh
npx claude-to-opencode --hooks-only
npx claude-to-opencode --hooks-only --apply
```
