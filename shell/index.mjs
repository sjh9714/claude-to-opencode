// DSH plugin shell around the dsh-movein CLI: exposes the migration as a
// model tool so a user can say "move my Claude Code setup over" inside DSH.
// The core logic lives in ../lib and is shared verbatim with the CLI.
// Registered as a raw JSON-Schema ToolDefinition (no host package imports,
// so the plugin resolves under link: installs and registry installs alike).
import { scan } from '../lib/scan.mjs'
import { scanOpenCode } from '../lib/opencode.mjs'
import { planActions, applyActions } from '../lib/apply.mjs'
import { renderReport } from '../lib/report.mjs'

export const name = 'dsh-movein'
export const inject = ['tools']

function definition(name, description, scanner) {
  return {
    name,
    description,
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
      const scanResult = scanner({ project })
      const actions = planActions(scanResult, { copy: args.copy === true })
      if (args.apply === true) applyActions(actions, { scanResult })
      return renderReport(scanResult, actions, { apply: args.apply === true })
    },
  }
}

export function apply(ctx) {
  ctx.tools.register(definition(
    'movein_from_claude_code',
    'Scan the local Claude Code setup and move its instructions, skills, commands, MCP servers, hooks, subagents, and permission rules into DSH. Dry run by default.',
    scan,
  ))
  ctx.tools.register(definition(
    'movein_from_opencode',
    'Scan the local OpenCode setup and move its instructions, skills, commands, agents, and MCP servers into DSH. Dry run by default.',
    scanOpenCode,
  ))
}
