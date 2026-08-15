# dsh-movein-permissions

Fine grained, per tool permission rules for [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness).

DSH ships three coarse permission presets (read-only, workspace-write, danger-full-access) and its README names the missing piece itself, there is no per tool allowlist. This plugin adds one at the `tools/pre-execute` gate, using Claude Code's battle tested rule syntax. You do not need to be migrating from Claude Code to use it.

为 DSH 补上按工具粒度的权限规则。DSH 自带的三档权限预设没有细粒度控制，这个插件在 `tools/pre-execute` 强制执行 deny/ask 规则，规则语法与 Claude Code 相同。不迁移也能单独用。

## Install

```sh
dsh plugin --profile web add dsh-movein-permissions
```

Then add a row to `~/.dsh/cordis.patch.yml` (or your profile's patch):

```yaml
- insert:
    - id: cc-permissions
      name: 'dsh-movein-permissions'
      config:
        deny:
          - 'Bash(rm -rf:*)'
          - 'Read(*secrets*)'
          - 'mcp__github__delete_repo'
        ask:
          - 'Write'
          - 'Bash(git push:*)'
```

Restart `dsh web`. Denied calls return a typed refusal to the model, ask rules force a confirmation.

## Rule syntax

Claude Code permission rule shape, `Tool` or `Tool(specifier)`.

| Rule | Meaning |
|---|---|
| `Bash(npm run test:*)` | any shell command starting with `npm run test` (matched on `terminal_*` tools) |
| `Read(*secrets*)` | any read whose path contains `secrets` |
| `Write` | every write |
| `mcp__server__tool` | one exact MCP tool, names are identical in DSH and Claude Code |

Mapped tools. `Bash` (terminal_open/terminal_send and friends), `Read`, `Write`, `Edit`, and every `mcp__*` tool. `*` patterns match as a superset, over-denying is the safe direction for a gate.

Deny wins over ask. Rules that reference tools with no DSH equivalent never match anything, harmless but pointless, the [dsh-movein](https://github.com/sjh9714/dsh-movein) migration report lists them for you.

## Coming from Claude Code?

`npx dsh-movein --apply` generates this row from your existing `settings.json` automatically, along with the rest of your setup.

## License

MIT
