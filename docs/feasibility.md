# DSH migration feasibility notes (2026-08-15, dsh @ 0.1.0-rc.6 source)

Source audit of deepseek-ai/deepseek-harness for the movein CLI. Paths are repo relative.

## Scorecard

| Area | Verdict | Key facts |
|---|---|---|
| CLAUDE.md | Free | `instructionFileCandidates` defaults to `['AGENTS.md','CLAUDE.md']`, local variants too (packages/context/agent-instructions). Chain is `$DSH_HOME/AGENTS.md` (global, AGENTS.md only) then project root down to cwd. Byte identical duplicates collapse |
| Skills | Nearly free | SKILL.md bundles or flat md, one level deep. Frontmatter parsed as open object, only `name` + `description` required, unknown keys (allowed-tools etc.) ignored. Roots by rank. 100 `<project>/.dsh/skills`, 200 `<project>/.agents/skills`, 400 `~/.dsh/skills`, 500 `~/.agents/skills`. `.claude/skills` is NOT a root, hence symlink. `customSkillDirs` resolves against process cwd once, useless for per project mapping |
| Hooks | Free-ish | First party `@deepseek-ai/dsh-hooks-claude-code` runs CC `hooks` config unchanged (configPath at settings file). 7 of 30 events mapped. SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop, SubagentStart, SubagentStop. command type only |
| MCP | Easy | One `@deepseek-ai/dsh-mcp-client` row per server. `serverName` + `transport: stdio|streamable-http`. Tool naming `mcp__server__tool` identical to CC. Nothing enabled by default |
| Permissions | Medium | No per tool allowlist, only three presets (read-only, workspace-write, danger-full-access). Escape hatch `ctx.on('tools/pre-execute', ...)` returning deny or ask. CC rules compile to ~40 line plugin. v0.2 |
| Subagents | Medium-hard | No `.claude/agents/*.md` import. Agent presets are directories with `agent.cordis.yml`, not markdown. Realistic path converts agent md to skills. Note `subagent-claude-code` provider literally spawns claude via agent sdk |
| Sessions | Hardest | `~/.dsh/sessions/<projectKey>/<id>/session.jsonl.zstd`, SESSION_FORMAT_VERSION 0, no compat promise, strict seq and turn step invariants. Only safe path is `ctx.sessions.create` with seed events using `source: {kind:'plugin', form:'recall'}`. Excluded from MVP |

## Plugin and patch mechanics

- Bundle skeleton. package.json with `"dsh": {"bundle": {"patch": "./cordis.patch.yml"}}` plus patch plus index export `apply(ctx)`.
- Layer order (later wins, per row, whole config replace). bundles in order, then `$DSH_HOME/profiles/<name>/cordis.patch.yml`, then `$DSH_HOME/cordis.patch.yml`, then `--patch` args. We write the home level file.
- `dsh plugin --profile <p> add <pkg>` forwards to pnpm in the profile dir and registers bundles.
- Host packages resolve for profile plugins through the flat symlink fallback at `$DSH_HOME/profiles/node_modules`.

## Empirical findings from this machine (not in the source audit)

1. A patch row whose package the profile cannot resolve is a FATAL boot error (plugin tree failed to load), not a warning. Rows must only be written after the package resolves. The CLI installs first and drops rows on failure.
2. npm dist-tags for satellite packages lag core. hooks-claude-code latest was 0.0.1-rc.5 while dsh was 0.1.0-rc.6. Installs must be pinned to the host dsh version (read from profiles/node_modules/@deepseek-ai/dsh).
3. `@deepseek-ai/dsh-hook-protocol` is a peer of hooks-claude-code that the host install does not ship in the fallback dir. It must be installed alongside.
4. `@deepseek-ai/dsh-mcp-client` IS in the host fallback, MCP rows need no install on stock installs.
5. `dsh web --port <n>` overrides the port (webserver row reads `ctx.webStartup.port`).

## Verified on 2026-08-15

- Fixture test green (test/test.mjs).
- Real apply on this machine. 4 skills linked, AGENTS.md linked, cc-hooks row in `dsh --profile web --dump-config` under the home patch layer.
- `dsh web --port 3099` boots clean with the full generated patch, zero module errors, HTTP 200.
- Not run yet. A live model turn confirming skill invocation and hook firing inside a session.
