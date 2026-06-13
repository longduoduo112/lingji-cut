import { describe, it, expect } from 'vitest';
import { BinaryManager } from '../electron/acp/binary-manager';
import { getAgentProfile } from '../electron/acp/agent-profiles';

describe('BinaryManager unmanaged spawn', () => {
  it('pi profile 返回 npx -y pi-acp（npx 解析失败时回退裸 npx）', async () => {
    const bm = new BinaryManager();
    const { command, args } = await bm.getSpawnCommandForProfile(getAgentProfile('pi-acp'), '');
    expect(command === 'npx' || command.endsWith('npx') || command.endsWith('npx.cmd')).toBe(true);
    expect(args).toEqual(['-y', 'pi-acp']);
  });
  it('claude profile 仍返回托管二进制 spawn（args 为空）', async () => {
    const bm = new BinaryManager();
    const { args } = await bm.getSpawnCommandForProfile(getAgentProfile('claude-acp'), '0.25.0');
    expect(args).toEqual([]);
  });
});
