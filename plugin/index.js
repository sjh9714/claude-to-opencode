// DSH permission gate driven by Claude Code permission rules.
// Config: { deny: ['Bash(rm -rf:*)', ...], ask: ['Write', ...] } - raw Claude
// Code rule strings, untranslated. Allow rules are not part of the config; the
// DSH permission preset already governs the default, this gate only tightens.

export const name = 'dsh-movein-permissions'

const isAsciiLetter = (code) => (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
const isToolBaseChar = (code) => isAsciiLetter(code) || (code >= 48 && code <= 57) || code === 95

function validToolName(tool) {
  if (!tool || (!isAsciiLetter(tool.charCodeAt(0)) && tool.charCodeAt(0) !== 95)) return false
  let hasMcpSegment = false
  for (let index = 1; index < tool.length; index += 1) {
    const code = tool.charCodeAt(index)
    if (isToolBaseChar(code)) {
      // A hyphen is valid only after a complete "__" segment delimiter. The
      // first underscore cannot double as both the required first character
      // and the delimiter, matching the previous rule grammar exactly.
      if (code === 95 && index >= 2 && tool.charCodeAt(index - 1) === 95) hasMcpSegment = true
      continue
    }
    if (code !== 45 || !hasMcpSegment) return false
  }
  return true
}

function splitRule(raw) {
  const text = String(raw).trim()
  if (!text) return null
  let open = -1
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    if (code === 10 || code === 13 || code === 0x2028 || code === 0x2029) return null
    if (code === 40 && open === -1) open = index
  }
  const hasSpec = open !== -1
  if (hasSpec && text.charCodeAt(text.length - 1) !== 41) return null
  const tool = hasSpec ? text.slice(0, open) : text
  if (!validToolName(tool)) return null
  return { tool, spec: hasSpec ? text.slice(open + 1, -1) : null }
}

// "Tool" or "Tool(spec)" where Tool is a CC tool name or mcp__server__tool.
export function parseRule(raw) {
  const parsed = splitRule(raw)
  if (!parsed) return null
  return { ...parsed, re: parsed.spec != null ? specToRegex(parsed.spec) : null }
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
