// DSH permission gate driven by Claude Code permission rules.
// Config: { deny: ['Bash(rm -rf:*)', ...], ask: ['Write', ...] } - raw Claude
// Code rule strings, untranslated. Allow rules are not part of the config; the
// DSH permission preset already governs the default, this gate only tightens.

export const name = 'dsh-movein-permissions'

// "Tool" or "Tool(spec)" where Tool is a CC tool name or mcp__server__tool.
export function parseRule(raw) {
  const m = /^([A-Za-z_][A-Za-z0-9_]*(?:__[A-Za-z0-9_-]+)*)(?:\((.*)\))?$/.exec(String(raw).trim())
  if (!m) return null
  return { tool: m[1], spec: m[2] ?? null, re: m[2] != null ? specToRegex(m[2]) : null }
}

// CC spec semantics: trailing ':*' is a prefix match; '*' is a wildcard.
// ponytail: every '*' becomes '.*' (a superset match) - over-denying is the
// safe direction for a permission gate; tighten if it ever bites.
function specToRegex(spec) {
  const prefix = spec.endsWith(':*')
  const body = prefix ? spec.slice(0, -2) : spec
  const esc = body.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp('^' + esc + (prefix ? '.*' : '$'))
}

// Map a DSH tool name back to the CC tool bucket its rules were written for.
function ccBucket(dshName) {
  if (dshName.startsWith('mcp__')) return dshName
  if (dshName.startsWith('terminal_')) return 'Bash'
  return { read: 'Read', write: 'Write', edit: 'Edit' }[dshName] ?? null
}

function candidateStrings(args) {
  if (!args || typeof args !== 'object') return []
  return ['command', 'input', 'text', 'file_path', 'path', 'url']
    .map((k) => args[k]).filter((v) => typeof v === 'string')
}

export function ruleMatches(rule, execName, execArgs) {
  const bucket = ccBucket(execName)
  if (rule.tool !== bucket && rule.tool !== execName) return false
  if (!rule.spec) return true
  return candidateStrings(execArgs).some((s) => rule.re.test(s))
}

export function apply(ctx, config = {}) {
  const deny = (config.deny ?? []).map(parseRule).filter(Boolean)
  const ask = (config.ask ?? []).map(parseRule).filter(Boolean)
  if (!deny.length && !ask.length) return
  ctx.on('tools/pre-execute', async (exec, next) => {
    if (deny.some((r) => ruleMatches(r, exec.name, exec.arguments))) {
      return { kind: 'deny', reason: 'Denied by a Claude Code permission rule (dsh-movein-permissions).' }
    }
    if (ask.some((r) => ruleMatches(r, exec.name, exec.arguments))) {
      return { kind: 'ask', reason: 'A Claude Code permission rule requests confirmation.' }
    }
    return next()
  })
}
