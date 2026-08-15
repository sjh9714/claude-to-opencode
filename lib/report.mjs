import { classifyPermissions } from './apply.mjs';
import { unknownHookEnvVars } from './scan.mjs';

const pad = (s, n) => (s.length >= n ? s : s + ' ' + '.'.repeat(Math.max(0, n - s.length - 2)) + ' ');

export function renderReport(scanResult, actions, { apply }) {
  const L = [];
  L.push('');
  L.push('📦 dsh-movein · Claude Code -> DeepSeek Harness moving estimate · 拎包入住');
  L.push('');

  const counts = {
    skills: scanResult.skills.global.length + scanResult.skills.project.length,
    mcp: new Set(scanResult.mcpServers.map((s) => s.name)).size,
    hooks: scanResult.hookConfigs.length,
    agents: scanResult.agents.global.length + scanResult.agents.project.length,
  };

  const icon = { native: '✓', move: apply ? '✓' : '→', done: '✓', skip: '−', error: '✗' };
  for (const a of actions) {
    L.push(`  ${icon[a.status] || '·'} ${pad(a.label, 34)}${a.note}`);
  }
  if (!actions.length) L.push('  − nothing found to move');

  L.push('');
  L.push(`  found: ${counts.skills} skills · ${counts.mcp} MCP servers · ${counts.hooks} hook configs · ${counts.agents} subagents · ${scanResult.permissionRules} permission rules · ${scanResult.sessionCount} sessions`);

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

  if (scanResult.sessionCount) L.push('  ○ sessions, out of scope, see dsh-chat-import for conversation history');
  L.push('');

  if (!actions.length) {
    L.push('  nothing to move. Is Claude Code set up on this machine (~/.claude)?');
    L.push('');
    return L.join('\n');
  }
  if (!apply) {
    L.push('  dry run, nothing written. Re-run with --apply to move in.');
  } else {
    const errors = actions.filter((a) => a.status === 'error');
    L.push(errors.length
      ? `  finished with ${errors.length} error(s), see lines above.`
      : '  moved in. Verify with: dsh --profile web --dump-config | grep -E "mcp-|cc-hooks"');
    if (!errors.length && actions.some((a) => a.status === 'done')) {
      L.push('  If the move saved you an afternoon, a star helps others find it:');
      L.push('  https://github.com/sjh9714/dsh-movein');
    }
  }
  L.push('');
  return L.join('\n');
}
