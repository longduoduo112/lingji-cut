import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { ConnectionRegistry, type SessionManagerLike } from '../electron/acp/connection-registry';
import type { ConnectionStatus } from '../electron/acp/types';

class MockSessionManager extends EventEmitter implements SessionManagerLike {
  private status: ConnectionStatus = 'disconnected';
  private sessionId: string | null = null;

  connect = vi.fn(
    async (
      _projectDir: string,
      _spawnCommand: string,
      _spawnArgs: string[],
      _env?: Record<string, string>,
      sessionId?: string | null,
    ) => {
      this.status = 'connecting';
      this.emit('status', this.status);
      this.sessionId = sessionId ?? `session-${Math.random().toString(36).slice(2, 8)}`;
      this.status = 'connected';
      this.emit('event', { type: 'session_started', sessionId: this.sessionId });
      this.emit('status', this.status);
    },
  );

  sendPrompt = vi.fn(async () => {
    this.status = 'prompting';
    this.emit('status', this.status);
    this.status = 'connected';
    this.emit('status', this.status);
  });

  cancelTurn = vi.fn(async () => {});
  setMode = vi.fn(async () => {});
  setConfigOption = vi.fn(async () => {});
  respondPermission = vi.fn(async () => {});
  disconnect = vi.fn(() => {
    this.status = 'disconnected';
    this.sessionId = null;
    this.emit('status', this.status);
  });

  getStatus(): ConnectionStatus {
    return this.status;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }
}

describe('ConnectionRegistry', () => {
  it('keeps separate runtime entries per conversation', async () => {
    const managers: MockSessionManager[] = [];
    const registry = new ConnectionRegistry({
      createSessionManager: () => {
        const manager = new MockSessionManager();
        managers.push(manager);
        return manager;
      },
    });

    await registry.connect({
      conversationId: 1,
      projectDir: '/tmp/a',
      spawnCommand: 'node',
      spawnArgs: ['mock-agent'],
    });
    await registry.connect({
      conversationId: 2,
      projectDir: '/tmp/a',
      spawnCommand: 'node',
      spawnArgs: ['mock-agent'],
      sessionId: 'conversation-2-session',
    });

    expect(registry.size()).toBe(2);
    expect(registry.get(1)?.sessionId).toBeTruthy();
    expect(registry.get(2)?.sessionId).toBe('conversation-2-session');
    expect(managers).toHaveLength(2);
  });

  it('routes send/cancel/disconnect to target conversation runtime', async () => {
    const managers: MockSessionManager[] = [];
    const registry = new ConnectionRegistry({
      createSessionManager: () => {
        const manager = new MockSessionManager();
        managers.push(manager);
        return manager;
      },
    });

    await registry.connect({
      conversationId: 11,
      projectDir: '/tmp/a',
      spawnCommand: 'node',
      spawnArgs: ['mock-agent'],
      sessionId: 's11',
    });
    await registry.connect({
      conversationId: 22,
      projectDir: '/tmp/a',
      spawnCommand: 'node',
      spawnArgs: ['mock-agent'],
      sessionId: 's22',
    });

    await registry.sendPrompt(22, [{ type: 'text', text: 'hello' }]);
    await registry.cancelTurn(11);
    registry.disconnect(11);

    expect(managers[0]?.sendPrompt).not.toHaveBeenCalled();
    expect(managers[1]?.sendPrompt).toHaveBeenCalledTimes(1);
    expect(managers[0]?.cancelTurn).toHaveBeenCalledTimes(1);
    expect(managers[1]?.cancelTurn).not.toHaveBeenCalled();
    expect(managers[0]?.disconnect).toHaveBeenCalledTimes(1);
    expect(managers[1]?.disconnect).not.toHaveBeenCalled();
    expect(registry.get(11)).toBeNull();
    expect(registry.get(22)?.sessionId).toBe('s22');
  });

  it('routes mode/config/permission actions to target conversation runtime', async () => {
    const managers: MockSessionManager[] = [];
    const registry = new ConnectionRegistry({
      createSessionManager: () => {
        const manager = new MockSessionManager();
        managers.push(manager);
        return manager;
      },
    });

    await registry.connect({
      conversationId: 31,
      projectDir: '/tmp/a',
      spawnCommand: 'node',
      spawnArgs: ['mock-agent'],
      sessionId: 's31',
    });
    await registry.connect({
      conversationId: 32,
      projectDir: '/tmp/a',
      spawnCommand: 'node',
      spawnArgs: ['mock-agent'],
      sessionId: 's32',
    });

    await registry.setMode(32, 'plan');
    await registry.setConfigOption(32, 'model', 'sonnet');
    await registry.respondPermission(31, 'req-1', 'allow');

    expect(managers[0]?.setMode).not.toHaveBeenCalled();
    expect(managers[1]?.setMode).toHaveBeenCalledWith('plan');
    expect(managers[1]?.setConfigOption).toHaveBeenCalledWith('model', 'sonnet');
    expect(managers[0]?.respondPermission).toHaveBeenCalledWith('req-1', 'allow');
    expect(managers[1]?.respondPermission).not.toHaveBeenCalled();
  });

  it('re-emits runtime status and events with conversationId', async () => {
    const manager = new MockSessionManager();
    const registry = new ConnectionRegistry({
      createSessionManager: () => manager,
    });

    const statuses: Array<{ conversationId: number; status: ConnectionStatus }> = [];
    const events: Array<{ conversationId: number; event: unknown }> = [];

    registry.on('status', (payload) => statuses.push(payload));
    registry.on('event', (payload) => events.push(payload));

    await registry.connect({
      conversationId: 7,
      projectDir: '/tmp/a',
      spawnCommand: 'node',
      spawnArgs: ['mock-agent'],
      sessionId: 'session-7',
    });
    manager.emit('event', { type: 'usage', used: 10, size: 20, sessionId: 'session-7' });

    expect(statuses.some((item) => item.conversationId === 7 && item.status === 'connected')).toBe(true);
    expect(events).toContainEqual({
      conversationId: 7,
      event: { type: 'usage', used: 10, size: 20, sessionId: 'session-7' },
    });
  });
});
