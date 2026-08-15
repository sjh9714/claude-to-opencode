# Show and tell #1672 update comment

v0.2.0 is out, both asks from the roadmap shipped together.

- Subagents (`.claude/agents/*.md`) now convert to DSH skills, the system prompt becomes the skill body
- Claude Code permission rules now carry over, `deny` and `ask` rules are enforced at the `tools/pre-execute` gate through a small companion plugin (dsh-movein-permissions). `allow` stays with your DSH permission preset

```sh
npx dsh-movein@latest --apply
```

Release notes https://github.com/sjh9714/dsh-movein/releases/tag/v0.2.0

子代理转技能与权限规则桥（deny/ask 在 `tools/pre-execute` 强制执行）都上了，`npx dsh-movein@latest` 即可。
