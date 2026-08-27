# dsh-movein

[中文](./docs/README.zh.md)

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-movein"><img alt="npm" src="https://img.shields.io/npm/v/dsh-movein?style=flat-square&color=4b6fff"></a>
  <a href="https://github.com/sjh9714/dsh-movein/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/sjh9714/dsh-movein/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-2EA44F?style=flat-square"></a>
</p>

Migrate your Claude Code setup into [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) without rebuilding it by hand.

Preview instructions, skills, commands, agents, hooks, permission rules, and MCP servers before DSH writes anything. Existing destinations stay untouched.

![The native DSH settings page previews and applies a Claude Code setup](./docs/settings-demo.gif)

This GIF uses two screenshots from a live DSH `0.1.1-rc.2` run. The first shows the dry run and the second shows the applied result.

If this saves you setup time, [star dsh-movein](https://github.com/sjh9714/dsh-movein).

## Import inside DSH

```sh
dsh plugin --profile web add dsh-movein
```

Restart `dsh web`, open **Settings**, then choose **Move in**.

- Claude Code is the primary path
- Dry run is the default
- Every category can be included or excluded
- Conflicts and unsupported entries appear before apply
- Codex and OpenCode stay available under the secondary origin panel

The same plugin also registers `movein_from_claude_code` and `movein_from_opencode` for model-driven use. Both tools stay dry until `apply=true`.

## Use the CLI

## Pick your origin

```sh
# Claude Code
npx dsh-movein
npx dsh-movein --apply

# Codex
npx dsh-movein --from codex
npx dsh-movein --from codex --apply

# OpenCode
npx dsh-movein --from opencode
npx dsh-movein --from opencode --apply
```

Every command is a dry run until `--apply` is present. Use `--copy` if you want copied skills instead of symlinks.

After a successful CLI apply, a human TTY asks `Star dsh-movein? (Enter = Yes) [Y/n]`; Yes uses the GitHub account authenticated in `gh`. A detected agent or any non-TTY prints `USER_CONFIRMATION_REQUIRED` and must ask the user before running exactly `npx dsh-movein --confirm-star yes` or `npx dsh-movein --confirm-star no`. CI never prompts, writes a marker, or calls the Star API. DSH Settings and model tools show only a user-clicked link and never call that API.

## Compatibility

| Origin | What moves |
| --- | --- |
| Claude Code | Global and project instructions, skills, slash commands, MCP servers, the supported hook configuration subset, subagents, and mapped permission rules |
| Codex | Global `AGENTS.md`, custom prompts, and stdio MCP servers from `config.toml` |
| OpenCode | Instructions, skills, commands, agents, and local or remote MCP servers from V1 or V2 JSON and JSONC config |

The [full compatibility matrix](docs/compat.md) names the source path, destination, preserved behavior, and unsupported parts for each origin.

## OpenCode as an origin

`--from opencode` follows OpenCode configuration precedence across the global config, `OPENCODE_CONFIG`, project configs, `.opencode` directories, and `OPENCODE_CONFIG_DIR`. Direct project configs load from the Git root toward the current directory, then `.opencode` configs load in the same order.

It supports both `opencode.json` and `opencode.jsonc`, including comments and trailing commas.

- `skill` and `skills` directories move as DSH skills
- `agent` and `agents` files convert to DSH skills
- `command` and `commands` files convert to user-invocable DSH skills
- Inline agents and commands convert the same way as file-based assets
- V1 agent `prompt` and V2 agent `system` both become the DSH skill body
- Local MCP command arrays split into DSH stdio command and args
- Remote MCP servers become streamable HTTP rows
- V1 MCP maps and V2 `mcp.servers` maps are both supported
- Disabled MCP servers stay disabled and appear in the report
- `{env:VAR}` stays a runtime `process.env.VAR` reference
- `{file:path}` stays visible for manual review and is never read by dsh-movein

Project `AGENTS.md` needs no move because DSH already reads it. One global instruction file can link to `~/.dsh/AGENTS.md` when that destination is free. Multiple files, globs, URLs, OpenCode permissions, and OpenCode plugins are reported instead of guessed.

If any JSONC file cannot be parsed, `--apply` is blocked before the first write.

## Safety

- Dry run is the default
- Existing destinations are skipped
- On Windows, a permission-denied symlink falls back to a copy and is named in the report
- `cordis.patch.yml` is backed up before each write
- `npx dsh-movein restore` restores the newest patch backup
- `~/.dsh/movein-manifest.json` records moved sources and destinations
- Environment placeholders remain runtime references
- Secret-looking plaintext values are reported before apply
- Sessions stay out of scope

## After moving

```sh
npx dsh-movein doctor
npx dsh-movein doctor --live
```

`doctor` checks recorded destinations, skill frontmatter, required packages, and a matching Claude Code hook bridge row for every settings file that contains supported command hooks. It also names hook configurations that cannot enforce what they appear to enforce: events outside DSH's seven mapped events, non-command handlers, uppercase Claude tool matcher alternatives, the current `{"continue":false}` control-flow gap, and the Windows PowerShell native-child exit-code gap. It never executes a user hook. Matching bridge rows and resolvable packages prove wiring only; `doctor` prints a disposable deny-canary reminder before you rely on hooks as a policy boundary.
`doctor --live` never activates the migrated configuration. It requires an already-installed `@deepseek-ai/dsh` `0.1.1-rc.2` or newer and first proves the boot-free `web --dump-config` contract in a separate disposable snapshot containing only the official `@deepseek-ai/dsh-base` and `@deepseek-ai/dsh-web-app` bundles and empty patch layers. Only after that succeeds does it ask DSH to compose the active migration snapshot. Both dumps must return a bounded, non-empty config with the expected sectioned YAML-list shape; their output is discarded and never printed. It then resets the active snapshot to the same official base/web-only configuration, boots it on an OS-assigned loopback port, and verifies its HTML boot wire and one same-origin JavaScript bundle. Static `doctor` checks the migrated package references separately.

No DSH download, model, or API credential is used. Child processes receive only a small OS, `PATH`, and locale allowlist; home, application-data, XDG, cache, and temporary paths all point inside the disposable snapshot. Shutdown signals the retained direct child handle and success requires observing that child exit and the loopback port become unreachable. It does not issue PID-tree kill commands. If child termination cannot be confirmed, the snapshot is preserved and the live check fails. Live checking requires the DSH-supported Node 22.19+ or 24+ runtime; Node 23 is rejected before any child starts.

Then inspect the composed DSH profile.

```sh
dsh --profile web --dump-config | grep -E "mcp-|cc-hooks"
```

Open a new DSH session after moving skills because the skill catalog is captured per session.

### Hook enforcement is not migration parity

Current DSH hook bridges have upstream enforcement gaps. On Windows, a command that launches a native interpreter can lose its exit code through PowerShell, so an intended exit-2 deny can fail open. When the command shape permits it, explicitly propagate the native status with `; exit $LASTEXITCODE`. On every platform, DSH currently records `{"continue":false}` but does not halt the run. Unsupported events outside the mapped seven are skipped during parsing. See [the measured hook limits and safe canary procedure](docs/compat.md#verify-hook-enforcement-after-moving) before treating a moved hook as a security boundary.

## Claude Code dual boot

DSH-born skills can return to Claude Code without copying assets that originally came from Claude Code.

```sh
npx dsh-movein --reverse
npx dsh-movein --reverse --apply
```

Reverse moving currently targets Claude Code only.

## Claude Code to OpenCode

The compatibility command remains available for users who need the full Claude Code to OpenCode migration route.

```sh
npx claude-to-opencode
npx claude-to-opencode --apply
```

If you only need Claude Code command hooks in OpenCode, use the focused [opencode-claude-code-hooks](https://github.com/sjh9714/opencode-claude-code-hooks) plugin instead.

## Not moved

- Sessions
- OpenCode permissions and plugins
- Codex approval and sandbox policy
- Instruction globs, remote instruction URLs, or multiple instruction files
- Hand-written DSH MCP and hook rows during reverse moving

Conversation history belongs in [dsh-chat-import](https://github.com/Nwflower/dsh-chat-import).

## Project status

The CLI migration paths retain their rc.6 and rc.7 regression coverage. CI also boots a packed release inside current DSH and verifies the browser client registration and settings route against DSH `0.1.1-rc.2`.

Listed in [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) and [awesome-deepseek-harness](https://github.com/0xsline/awesome-deepseek-harness). The measured migration notes also appear in [dsh-handbook](https://github.com/Electricitysheep/dsh-handbook).

## Star history

[![Star History Chart](https://api.star-history.com/svg?repos=sjh9714/dsh-movein&type=Date)](https://star-history.com/#sjh9714/dsh-movein&Date)

## License

MIT
