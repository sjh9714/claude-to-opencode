// DSH plugin shell around the dsh-movein CLI: exposes the migration as a
// model tool so a user can say "move my Claude Code setup over" inside DSH.
// The core logic lives in ../lib and is shared verbatim with the CLI.
// Registered as a raw JSON-Schema ToolDefinition (no host package imports,
// so the plugin resolves under link: installs and registry installs alike).
import { scan } from '../lib/scan.mjs'
import { planActions, applyActions } from '../lib/apply.mjs'
import { renderReport } from '../lib/report.mjs'

export const name = 'dsh-movein'
export const inject = ['tools']

export function apply(ctx) {
  ctx.tools.register({
    name: 'movein_from_claude_code',
    description: 'Scan the local Claude Code setup (CLAUDE.md, skills, .mcp.json MCP servers, hooks, subagents, permission rules) and move it into DSH. Dry run by default and returns a moving-estimate report; call again with apply=true to perform the move. Changes to the plugin patch need a dsh restart to take effect.',
    parameters: {
      type: 'object',
      properties: {
        apply: { type: 'boolean', description: 'false or omitted = dry run report only, true = perform the move' },
        project: { type: 'string', description: 'Absolute project directory to scan, defaults to the dsh host process cwd' },
        copy: { type: 'boolean', description: 'Copy skills instead of symlinking' },
      },
      additionalProperties: false,
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    async execute(rawArgs) {
      const args = rawArgs && typeof rawArgs === 'object' ? rawArgs : {}
      const project = typeof args.project === 'string' && args.project ? args.project : process.cwd()
      const scanResult = scan({ project })
      const actions = planActions(scanResult, { copy: args.copy === true })
      if (args.apply === true) applyActions(actions, { scanResult })
      return renderReport(scanResult, actions, { apply: args.apply === true })
    },
  })
}
