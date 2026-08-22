# claude-to-opencode

Switch to OpenCode without losing Claude Code memory or command guardrails.

```sh
npx claude-to-opencode
npx claude-to-opencode --apply
```

The first command is a dry run. It shows the exact destinations and everything that stays manual.

To install only the hook bridge into an existing OpenCode setup, run this instead.

```sh
npx claude-to-opencode --hooks-only
npx claude-to-opencode --hooks-only --apply
```

Existing `Bash` blockers, secret checks, and edit-time linters continue to run from the original Claude settings.

It handles the current project's auto memory, global and project instructions, unconditional rules, commands, subagents, local or remote MCP servers, and `PreToolUse` or `PostToolUse` command hooks. Auto memory stays in its Claude directory and is referenced by OpenCode, so later updates remain visible. Hook commands stay in Claude settings and run through a generated OpenCode plugin. OpenCode reads Claude skills directly, so the command leaves those files in place. Existing destinations and secret-looking plaintext values are not copied.

Path-scoped Claude rules, other hook events and hook types, permissions, and sessions stay manual because OpenCode does not give them the same semantics.

The [repository](https://github.com/sjh9714/claude-to-opencode) also contains the full `dsh-movein` implementation and its safety tests.
