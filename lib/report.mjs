import { classifyPermissions } from './apply.mjs';
import { unknownHookEnvVars, riskyFrontmatter, secretFindings, deadHooks } from './scan.mjs';

const pad = (s, n) => (s.length >= n ? s : s + ' ' + '.'.repeat(Math.max(0, n - s.length - 2)) + ' ');

export function renderReport(scanResult, actions, { apply }) {
  const L = [];
  L.push('');
  L.push(`📦 dsh-movein · ${scanResult.origin || 'Claude Code'} -> DeepSeek Harness moving estimate · 拎包入住`);
  L.push('');

  const counts = {
    skills: scanResult.skills.global.length + scanResult.skills.project.length,
    mcp: new Set(scanResult.mcpServers.map((s) => s.name)).size,
    hooks: scanResult.hookConfigs.length,
    agents: scanResult.agents.global.length + scanResult.agents.project.length + (scanResult.inlineAgents?.length ?? 0),
    commands: scanResult.commands.global.length + scanResult.commands.project.length + (scanResult.inlineCommands?.length ?? 0),
  };

  const icon = { native: '✓', move: '→', done: '✓', skip: '−', error: '✗' };
  for (const a of actions) {
    L.push(`  ${icon[a.status] || '·'} ${pad(a.label, 34)}${a.note}`);
  }
  if (!actions.length) L.push('  − nothing found to move');

  for (const notice of scanResult.notices ?? []) {
    L.push(`  ⚠ ${notice.message}${notice.sourcePath ? ` (${notice.sourcePath})` : ''}`);
  }

  L.push('');
  L.push(`  found: ${counts.skills} skills · ${counts.commands} commands · ${counts.mcp} MCP servers · ${counts.hooks} hook configs · ${counts.agents} subagents · ${scanResult.permissionRules} permission rules · ${scanResult.sessionCount} sessions`);

  // migration diff for permission rules - name what carried over and what did not
  const perms = classifyPermissions(scanResult.permissions);
  const totalDenyAsk = scanResult.permissions.deny.length + scanResult.permissions.ask.length;
  if (totalDenyAsk) {
    L.push(`  permissions: ${perms.deny.length + perms.ask.length}/${totalDenyAsk} deny+ask rules enforced in DSH, '*' patterns match as a superset`);
    for (const r of perms.unmapped) L.push(`    ✗ not mapped, no DSH-side tool: ${r}`);
    L.push('  − allow rules stay with the DSH permission preset');
  }

  // hook scripts referencing env vars DSH will not provide
  for (const v of unknownHookEnvVars(scanResult.hookConfigs)) {
    L.push(`  ⚠ hook references $${v.name} (${v.scope} settings), may be unset under DSH`);
  }

  // hooks that will silently never run under the DSH bridge
  for (const d of deadHooks(scanResult.hookConfigs)) {
    L.push(`  ⚠ hook ${d.event} (${d.scope} settings): ${d.why}`);
  }

  // skills whose frontmatter DSH's YAML parser silently drops (#1401)
  for (const s of [...scanResult.skills.global, ...scanResult.skills.project]) {
    const risk = riskyFrontmatter(s.dir);
    if (risk) L.push(`  ⚠ skill ${s.name}, ${risk}`);
  }

  // plaintext secrets that --apply would copy into ~/.dsh config
  for (const where of secretFindings(scanResult)) {
    L.push(`  ⚠ secret-looking value in ${where} would be copied into ~/.dsh config, prefer \${VAR} references`);
  }

  if (scanResult.sessionCount) L.push('  ○ sessions, out of scope, see dsh-chat-import for conversation history');
  L.push('');

  if (!actions.length) {
    const setupPath = scanResult.origin === 'Codex'
      ? '~/.codex'
      : scanResult.origin === 'OpenCode'
        ? '~/.config/opencode or the project opencode.json'
        : '~/.claude';
    L.push(`  nothing to move. Is ${scanResult.origin || 'Claude Code'} set up on this machine (${setupPath})?`);
    L.push('');
    return L.join('\n');
  }
  if (!apply) {
    L.push('  dry run, nothing written. Re-run with --apply to move in.');
  } else {
    const errors = actions.filter((a) => a.status === 'error');
    const blocked = errors.some((a) => a.preflight);
    L.push(errors.length
      ? blocked
        ? `  blocked by ${errors.length} config error(s), nothing written.`
        : `  finished with ${errors.length} error(s), see lines above.`
      : '  moved in. Verify with: dsh --profile web --dump-config | grep -E "mcp-|cc-hooks"');
    if (!errors.length && actions.some((a) => a.status === 'done')) {
      L.push('  open a NEW dsh session to see the moved skills (the catalog is snapshotted per session).');
      L.push('  check the result anytime: npx dsh-movein doctor · full notes: https://github.com/sjh9714/dsh-movein/blob/main/docs/compat.md');
    }
  }
  L.push('');
  return L.join('\n');
}
