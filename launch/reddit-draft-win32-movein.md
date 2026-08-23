# Reddit draft

Not published. Show this exact draft to the user before posting.

## Title

Set up DSH on Windows and import a Claude Code setup with two commands

## Body

Current DeepSeek Harness now includes persistent PowerShell and a Windows Workspace Write sandbox. I updated two small tools around the parts that are still easy to get wrong.

```powershell
npx dsh-win32 setup
npx dsh-movein --apply
```

The first command checks the official Windows stack, detects known PowerShell and koffi failures, and creates a desktop shortcut. It does not install Git, WSL, PowerShell, or a custom DSH preset.

The second command imports a Claude Code setup into DSH. It handles instructions, skills, slash commands, subagents, supported hooks, permission rules, and MCP servers. A dry run is the default, existing destinations are skipped, and unsupported entries stay visible instead of being guessed.

There is also a native DSH settings page if you prefer to select each category before applying.

dsh-win32

https://github.com/sjh9714/dsh-win32

dsh-movein

https://github.com/sjh9714/dsh-movein

I would especially like reports from Windows users with an existing Claude Code setup. Which part still needs manual repair after these two commands?
