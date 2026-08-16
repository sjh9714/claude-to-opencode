# Why your Claude Code skill silently vanishes in DSH

A skill that works every day in Claude Code can be invisible in DeepSeek Harness, with no error, no log line, nothing. This page documents the exact mechanism, measured against the DSH source (`0.1.0-rc.6`), and how to detect it before it bites. Related upstream discussion, [#1401](https://github.com/deepseek-ai/deepseek-harness/discussions/1401).

## The mechanism

Claude Code and DSH read the same `SKILL.md` file but parse the frontmatter differently.

- **Claude Code** reads frontmatter with a lenient line-based parser. `description: Priority order: check the cache first` is fine, everything after the first colon becomes the value.
- **DSH** feeds the frontmatter block to the full [`yaml`](https://www.npmjs.com/package/yaml) npm parser as an open object. In real YAML, a second `: ` (colon plus space) on a plain scalar line is a syntax error (`Nested mappings are not allowed in compact mappings`). The parse throws.

DSH catches the throw per skill and moves on. The result, the skill is simply absent from the catalog. It does not appear in the skill list, the agent never sees it, and nothing is printed. From the user's side the skill just does not exist.

## The shapes that trigger it

Any frontmatter value with an unquoted `: ` sequence, most commonly in `description`:

```yaml
---
name: my-skill
description: Priority order: check the cache first    # vanishes in DSH
---
```

Safe shapes, all equivalent:

```yaml
description: 'Priority order: check the cache first'  # single quoted
description: "Priority order: check the cache first"  # double quoted
description: >-                                       # block scalar
  Priority order: check the cache first
```

A file with no frontmatter block at all is also skipped (nothing to catalog).

Colons **without** a following space (`10:30`, `foo:bar`) are fine, that is a valid plain scalar in YAML.

## Two extra traps stacked on top

1. **The catalog is snapshotted per session** ([#1650](https://github.com/deepseek-ai/deepseek-harness/issues/1650)). Fixing the frontmatter mid-session changes nothing you can see. Open a new session to re-scan.
2. **Symlinked skills are followed** (the scanner uses stat semantics), so a skill moved in by symlink behaves exactly like a local one, including this failure. Moving the file did not cause the problem and copying it will not fix it.

## Detecting it

`dsh-movein` flags the shape at both ends of the move:

```sh
npx dsh-movein          # dry run warns per skill before anything moves
npx dsh-movein doctor   # checks skills already inside DSH roots, any time
```

Both print the same warning:

```
⚠ skill release-helper, unquoted ": " in description, DSH drops the whole skill silently (#1401)
```

The fix is always the same, quote the description, then open a new DSH session.

## Why Claude Code never told you

Claude Code's parser has no concept of nested mappings, so the file was never broken there. This is not a bad skill, it is a dialect difference between a lenient parser and a spec-complete one. Until the upstream discussion lands on a resolution (lenient fallback or a visible warning), detection on the migration path is the practical answer.
