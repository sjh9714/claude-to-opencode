# claude-to-opencode

Move an existing Claude Code setup into OpenCode without rebuilding it by hand.

```sh
npx claude-to-opencode
npx claude-to-opencode --apply
```

The first command is a dry run. It shows the exact destinations and everything that stays manual.

It handles global and project instructions, unconditional rules, commands, subagents, and local or remote MCP servers. OpenCode reads Claude skills directly, so the command leaves those files in place. Existing destinations and secret-looking plaintext values are not copied.

Path-scoped Claude rules, hooks, permissions, and sessions stay manual because OpenCode does not give them the same semantics.

This is the search-friendly entry point for [dsh-movein](https://github.com/sjh9714/dsh-movein), which owns the implementation and safety tests.
