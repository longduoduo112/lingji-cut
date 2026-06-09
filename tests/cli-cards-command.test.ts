// tests/cli-cards-command.test.ts
import { describe, it, expect } from 'vitest';
import { runCardsCommand } from '../cli/src/commands/cards';
import type { ToolCaller } from '../cli/src/client';
function fake() { const calls: any[] = []; return { calls, client: { async call(n: string, a?: unknown) { calls.push({ name: n, args: a }); return n === 'lingji_get_active_project' ? { projectPath: '/p' } : { taskId: 't' }; }, async close() {} } as ToolCaller }; }
describe('runCardsCommand', () => {
  it('gen → lingji_analyze_subtitles (cards 随分析产出)', async () => { const { client, calls } = fake(); await runCardsCommand('gen', {}, client); expect(calls.some((c) => c.name === 'lingji_analyze_subtitles')).toBe(true); });
  it('unknown → bad_args', async () => { const { client } = fake(); await expect(runCardsCommand('x', {}, client)).rejects.toMatchObject({ code: 'bad_args' }); });
});
