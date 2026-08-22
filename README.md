# dsh-movein

[中文](./README.zh.md)

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-movein"><img alt="npm" src="https://img.shields.io/npm/v/dsh-movein?style=flat-square&color=4b6fff"></a>
  <a href="https://github.com/sjh9714/dsh-movein/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/sjh9714/dsh-movein/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-2EA44F?style=flat-square"></a>
  <a href="https://www.npmjs.com/package/dsh-movein"><img alt="downloads" src="https://img.shields.io/npm/dm/dsh-movein?style=flat-square&color=8250df"></a>
</p>

Move your Claude Code, Codex, or OpenCode setup into [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness).

One command finds the parts DSH can use, shows a dry run, and moves them without overwriting existing destinations.

![A dsh-movein dry run showing Claude Code assets moving into DSH](https://raw.githubusercontent.com/sjh9714/dsh-movein/main/docs/report.png)

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

## Use it inside DSH

```sh
dsh plugin --profile web add dsh-movein
```

Restart `dsh web`. The plugin adds two tools.

- `movein_from_claude_code`
- `movein_from_opencode`

Both tools are dry run by default and accept `apply=true` when you are ready.

## Compatibility

| Origin | What moves |
| --- | --- |
| Claude Code | Global and project instructions, skills, slash commands, MCP servers, supported hooks, subagents, and mapped permission rules |
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
```

`doctor` checks recorded destinations, skill frontmatter, required packages, and supported Claude Code hook mappings.

Then inspect the composed DSH profile.

```sh
dsh --profile web --dump-config | grep -E "mcp-|cc-hooks"
```

Open a new DSH session after moving skills because the skill catalog is captured per session.

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

Tested end to end against DSH `0.1.0-rc.6` and `0.1.0-rc.7`. CI runs the same tests with `npm ci` on Linux, macOS, and Windows.

Listed in [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) and [awesome-deepseek-harness](https://github.com/0xsline/awesome-deepseek-harness). The measured migration notes also appear in [dsh-handbook](https://github.com/Electricitysheep/dsh-handbook).

## Star history

[![Star History Chart](https://api.star-history.com/svg?repos=sjh9714/dsh-movein&type=Date)](https://star-history.com/#sjh9714/dsh-movein&Date)

## License

MIT
