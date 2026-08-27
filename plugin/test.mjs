import assert from 'node:assert'
import { performance } from 'node:perf_hooks'
import { apply, parseRule, ruleMatches } from './index.js'

// matcher basics
assert.ok(ruleMatches(parseRule('Bash(npm run test:*)'), 'terminal_open', { command: 'npm run test -- --watch' }))
assert.ok(!ruleMatches(parseRule('Bash(npm run test:*)'), 'terminal_open', { command: 'npm install' }))
assert.ok(ruleMatches(parseRule('Bash(rm -rf:*)'), 'terminal_send', { input: 'rm -rf /tmp/x' }))
assert.ok(ruleMatches(parseRule('Read'), 'read', { file_path: '/etc/hosts' }))
assert.ok(ruleMatches(parseRule('Read(*secrets*)'), 'read', { file_path: '/app/secrets/key.pem' }))
assert.ok(!ruleMatches(parseRule('Read(*secrets*)'), 'read', { file_path: '/app/src/main.ts' }))
assert.ok(ruleMatches(parseRule('mcp__github__create_issue'), 'mcp__github__create_issue', {}))
assert.ok(!ruleMatches(parseRule('Bash'), 'read', {}))
assert.ok(!ruleMatches(parseRule('WebFetch'), 'read', {}), 'unknown CC tool never matches DSH tools')

// Preserve the accepted rule grammar without the overlapping repetitions that
// made a late failure exponentially expensive.
assert.deepStrictEqual(
  (({ tool, spec }) => ({ tool, spec }))(parseRule('Bash(foo)(bar)')),
  { tool: 'Bash', spec: 'foo)(bar' },
)
assert.strictEqual(parseRule('__-'), null)
assert.strictEqual(parseRule('Bash(line\nbreak)'), null)
assert.strictEqual(parseRule('___-').tool, '___-')
const adversarial = `A${'__x'.repeat(50_000)}!`
const parseStarted = performance.now()
assert.strictEqual(parseRule(adversarial), null)
assert.ok(performance.now() - parseStarted < 1_000, 'malformed rules must be rejected in linear time')

// gate wiring through a fake ctx
let handler = null
const ctx = { on: (ev, h) => { assert.strictEqual(ev, 'tools/pre-execute'); handler = h } }
apply(ctx, { deny: ['Bash(rm -rf:*)'], ask: ['Write'] })
const next = async () => ({ kind: 'allow' })

assert.deepStrictEqual((await handler({ name: 'terminal_open', arguments: { command: 'rm -rf /' } }, next)).kind, 'deny')
assert.deepStrictEqual((await handler({ name: 'write', arguments: { file_path: 'a.txt' } }, next)).kind, 'ask')
assert.deepStrictEqual((await handler({ name: 'read', arguments: { file_path: 'a.txt' } }, next)).kind, 'allow')

// empty config registers nothing
let registered = false
apply({ on: () => { registered = true } }, {})
assert.ok(!registered)

console.log('ok - plugin assertions passed')
