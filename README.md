# dsh-movein

[中文](./README.zh.md)

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-movein"><img alt="npm" src="https://img.shields.io/npm/v/dsh-movein?style=flat-square&color=4b6fff"></a>
  <a href="https://github.com/sjh9714/dsh-movein/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/sjh9714/dsh-movein/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-2EA44F?style=flat-square"></a>
  <a href="https://www.npmjs.com/package/dsh-movein"><img alt="downloads" src="https://img.shields.io/npm/dm/dsh-movein?style=flat-square&color=8250df"></a>
</p>

Leave Claude Code without rebuilding your setup.

One command previews and moves auto memory, instructions, unconditional rules, commands, agents, and MCP servers into OpenCode. The same CLI can move Claude Code, Codex, or OpenCode assets into [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness).

![Claude Code setup moving safely into OpenCode](https://raw.githubusercontent.com/sjh9714/dsh-movein/main/docs/demo.gif)

The animation recreates the real CLI flow. The generated files were also loaded with OpenCode `1.18.21` through `debug config`, `debug skill`, and `debug agent`.

## Claude Code to OpenCode

```sh
npx dsh-movein --from claude --to opencode
npx dsh-movein --from claude --to opencode --apply
```

The shorter search-friendly entry point runs the same code.

```sh
npx claude-to-opencode
npx claude-to-opencode --apply
```

The first command is only a preview.

- Global and project `CLAUDE.md` files link to the matching OpenCode `AGENTS.md` when the destination is free
- The current project's Claude auto memory stays in place and is referenced from the project OpenCode config, so later memory updates remain visible
- Unconditional `.claude/rules` files are referenced from OpenCode config. Path-scoped rules stay manual instead of being applied everywhere
- Claude skills stay where they are because OpenCode reads `.claude/skills` directly
- Commands copy into OpenCode command directories without changing `$ARGUMENTS`
- Claude subagents become OpenCode subagents without guessing tool permissions
- User and project MCP servers merge into the matching OpenCode JSON or JSONC config
- `${VAR}` becomes `{env:VAR}` and the current environment value is never read
- Existing destinations and MCP names are skipped
- A secret-looking plaintext MCP value is reported and not copied
- An invalid target config blocks every write

## Move into DSH

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

| Route | What moves |
| --- | --- |
| Claude Code to OpenCode | Auto memory, instructions, unconditional rules, commands, subagents, and local or remote MCP servers. Skills remain native and are not duplicated |
| Claude Code to DSH | Global and project instructions, skills, slash commands, MCP servers, supported hooks, subagents, and mapped permission rules |
| Codex to DSH | Global `AGENTS.md`, custom prompts, and stdio MCP servers from `config.toml` |
| OpenCode to DSH | Instructions, skills, commands, agents, and local or remote MCP servers from V1 or V2 JSON and JSONC config |

The [full compatibility matrix](docs/compat.md) names the source path, destination, preserved behavior, and unsupported parts for each origin.

## OpenCode support

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
- OpenCode JSONC comments and unrelated settings are preserved
- Auto memory is referenced from its existing local file and is not copied
- OpenCode config files are backed up beside the original before a merge
- `~/.config/opencode/dsh-movein-manifest.json` records OpenCode moves
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

## Not moved

- Sessions
- OpenCode permissions and plugins
- Codex approval and sandbox policy
- Instruction globs, remote instruction URLs, or multiple instruction files
- Hand-written DSH MCP and hook rows during reverse moving

Conversation history belongs in [dsh-chat-import](https://github.com/Nwflower/dsh-chat-import).

## Project status

Tested end to end against OpenCode `1.18.21` and DSH `0.1.0-rc.6` and `0.1.0-rc.7`. CI runs the same tests with `npm ci` on Linux, macOS, and Windows.

Listed in [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) and [awesome-deepseek-harness](https://github.com/0xsline/awesome-deepseek-harness). The measured migration notes also appear in [dsh-handbook](https://github.com/Electricitysheep/dsh-handbook).

## Star history

[![Star History Chart](https://api.star-history.com/svg?repos=sjh9714/dsh-movein&type=Date)](https://star-history.com/#sjh9714/dsh-movein&Date)

## License

MIT
