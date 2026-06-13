import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { RuntimeRegistry } from '../../electron/agent-runtime/runtime-registry';
import type { AgentSessionStartInput } from '../../electron/agent-runtime/session';
import type { AgentStreamEvent } from '../../electron/agent-runtime/event-model';

// ─── Fake AgentSession ───────────────────────────────────────────────────────

/**
 * 可控的假 AgentSession：start() 记录 input，并把内部缓存的脚本事件
 * 依次喂给 input.onEvent；亦可手动 emit。cancel() 记录调用。
 */
class FakeSession {
  static instances: FakeSession[] = [];
  lastInput: AgentSessionStartInput | null = null;
  startCalls = 0;
  cancelCalls = 0;
  /** 启动时自动 emit 的事件序列（可选） */
  script: AgentStreamEvent[] = [];
  /** true 时 start() 返回的 promise 永不 resolve（模拟轮进行中） */
  pending = false;

  constructor() {
    FakeSession.instances.push(this);
  }

  async start(input: AgentSessionStartInput): Promise<void> {
    this.startCalls += 1;
    this.lastInput = input;
    for (const ev of this.script) {
      input.onEvent(ev);
    }
    if (this.pending) {
      await new Promise<void>(() => {
        /* 永挂起 */
      });
    }
  }

  /** 手动把事件喂给最近一次 start 的 onEvent */
  emit(ev: AgentStreamEvent): void {
    this.lastInput?.onEvent(ev);
  }

  cancel(): void {
    this.cancelCalls += 1;
  }
}

function makeRegistry(): {
  registry: RuntimeRegistry;
  sessions: FakeSession[];
} {
  FakeSession.instances = [];
  const sessions: FakeSession[] = FakeSession.instances;
  const registry = new RuntimeRegistry({
    createSession: () => new FakeSession() as any,
  });
  return { registry, sessions };
}

const baseConnect = {
  conversationId: 1,
  agentType: 'claude',
  projectDir: '/proj',
};

describe('RuntimeRegistry', () => {
  let statusEvents: Array<{ conversationId: number; status: string }>;
  let runtimeEvents: Array<{ conversationId: number; event: any }>;

  function attachListeners(registry: RuntimeRegistry) {
    statusEvents = [];
    runtimeEvents = [];
    registry.on('status', (p: any) => statusEvents.push(p));
    registry.on('event', (p: any) => runtimeEvents.push(p));
  }

  beforeEach(() => {
    statusEvents = [];
    runtimeEvents = [];
  });

  it('connect 登记会话上下文但不 spawn（不创建 session.start）', async () => {
    const { registry, sessions } = makeRegistry();
    attachListeners(registry);

    await registry.connect({ ...baseConnect });

    // connect 不应触发任何 start
    const started = sessions.filter((s) => s.startCalls > 0);
    expect(started.length).toBe(0);
    // 登记后应有快照
    expect(registry.get(1)).not.toBeNull();
    // connect 发出 connected/disconnected 之类的 status（至少要存在一个 status 事件）
    expect(statusEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('connect 未知 agentType 抛错', async () => {
    const { registry } = makeRegistry();
    await expect(
      registry.connect({ ...baseConnect, agentType: 'nope-xyz' }),
    ).rejects.toThrow();
  });

  it('sendPrompt 触发 fake session.start，prompt 为 contents 文本化', async () => {
    const { registry, sessions } = makeRegistry();
    attachListeners(registry);

    await registry.connect({ ...baseConnect, model: 'm1' });
    await registry.sendPrompt(1, [{ type: 'text', text: 'hello' }, { type: 'text', text: 'world' }]);

    const started = sessions.filter((s) => s.startCalls > 0);
    expect(started.length).toBe(1);
    const input = started[0].lastInput!;
    expect(input.prompt).toContain('hello');
    expect(input.prompt).toContain('world');
    expect(input.cwd).toBe('/proj');
    expect(input.model).toBe('m1');
    expect(typeof input.onEvent).toBe('function');
  });

  it('text_delta → emit event {type:text}', async () => {
    const { registry, sessions } = makeRegistry();
    attachListeners(registry);
    await registry.connect({ ...baseConnect });
    await registry.sendPrompt(1, [{ type: 'text', text: 'hi' }]);
    const session = sessions.find((s) => s.startCalls > 0)!;
    session.emit({ type: 'text_delta', delta: 'abc' });

    const ev = runtimeEvents.find((e) => e.event.type === 'text');
    expect(ev).toBeTruthy();
    expect(ev!.conversationId).toBe(1);
    expect(ev!.event.text).toBe('abc');
  });

  it('tool_use → emit event {type:tool_call}', async () => {
    const { registry, sessions } = makeRegistry();
    attachListeners(registry);
    await registry.connect({ ...baseConnect });
    await registry.sendPrompt(1, [{ type: 'text', text: 'hi' }]);
    const session = sessions.find((s) => s.startCalls > 0)!;
    session.emit({ type: 'tool_use', id: 't1', name: 'Read', input: { path: '/x' } });

    const ev = runtimeEvents.find((e) => e.event.type === 'tool_call');
    expect(ev).toBeTruthy();
    expect(ev!.event.toolCallId).toBe('t1');
    expect(ev!.event.title).toBe('Read');
  });

  it('turn_end → emit event {type:turn_complete}', async () => {
    const { registry, sessions } = makeRegistry();
    attachListeners(registry);
    await registry.connect({ ...baseConnect });
    await registry.sendPrompt(1, [{ type: 'text', text: 'hi' }]);
    const session = sessions.find((s) => s.startCalls > 0)!;
    session.emit({ type: 'turn_end', stopReason: 'end_turn' });

    const ev = runtimeEvents.find((e) => e.event.type === 'turn_complete');
    expect(ev).toBeTruthy();
    expect(ev!.event.stopReason).toBe('end_turn');
  });

  it('toRuntimeEvent 返回 null 的事件（status / thinking_start）被忽略', async () => {
    const { registry, sessions } = makeRegistry();
    attachListeners(registry);
    await registry.connect({ ...baseConnect });
    await registry.sendPrompt(1, [{ type: 'text', text: 'hi' }]);
    const session = sessions.find((s) => s.startCalls > 0)!;
    const before = runtimeEvents.length;
    session.emit({ type: 'status', label: 'thinking' });
    session.emit({ type: 'thinking_start' });
    expect(runtimeEvents.length).toBe(before);
  });

  it('error 事件经 toRuntimeEvent 转发为 event {type:error}', async () => {
    const { registry, sessions } = makeRegistry();
    attachListeners(registry);
    await registry.connect({ ...baseConnect });
    await registry.sendPrompt(1, [{ type: 'text', text: 'hi' }]);
    const session = sessions.find((s) => s.startCalls > 0)!;
    session.emit({ type: 'error', message: 'boom' });

    const ev = runtimeEvents.find((e) => e.event.type === 'error');
    expect(ev).toBeTruthy();
    expect(ev!.event.message).toBe('boom');
  });

  it('sendPrompt 发出 prompting → connected 的 status 序列', async () => {
    const { registry, sessions } = makeRegistry();
    attachListeners(registry);
    await registry.connect({ ...baseConnect });
    statusEvents = [];
    await registry.sendPrompt(1, [{ type: 'text', text: 'hi' }]);
    const s = sessions.find((x) => x.startCalls > 0)!;
    s.emit({ type: 'turn_end', stopReason: 'end_turn' });

    const statuses = statusEvents.map((e) => e.status);
    expect(statuses).toContain('prompting');
    // turn 结束后回落到 connected
    expect(statuses[statuses.length - 1]).toBe('connected');
  });

  it('cancelTurn 调 session.cancel（轮进行中）', async () => {
    const created: FakeSession[] = [];
    const registry = new RuntimeRegistry({
      createSession: () => {
        const s = new FakeSession();
        s.pending = true; // 模拟进行中的轮
        created.push(s);
        return s as any;
      },
    });
    attachListeners(registry);
    await registry.connect({ ...baseConnect });
    // 不 await：start 永挂起，轮保持进行中
    void registry.sendPrompt(1, [{ type: 'text', text: 'hi' }]);
    const session = created.find((s) => s.startCalls > 0)!;
    registry.cancelTurn(1);
    expect(session.cancelCalls).toBe(1);
  });

  it('disconnect 清理会话；之后 sendPrompt 抛错', async () => {
    const { registry } = makeRegistry();
    attachListeners(registry);
    await registry.connect({ ...baseConnect });
    registry.disconnect(1);
    expect(registry.get(1)).toBeNull();
    expect(statusEvents.some((e) => e.status === 'disconnected')).toBe(true);
    await expect(registry.sendPrompt(1, [{ type: 'text', text: 'x' }])).rejects.toThrow();
  });

  it('多会话隔离：两个 conversationId 各自事件不串', async () => {
    const { registry, sessions } = makeRegistry();
    attachListeners(registry);
    await registry.connect({ conversationId: 1, agentType: 'claude', projectDir: '/p1' });
    await registry.connect({ conversationId: 2, agentType: 'codex', projectDir: '/p2' });
    await registry.sendPrompt(1, [{ type: 'text', text: 'one' }]);
    await registry.sendPrompt(2, [{ type: 'text', text: 'two' }]);

    const startedFor = (cid: number) =>
      sessions.filter((s) => s.startCalls > 0 && s.lastInput?.cwd === (cid === 1 ? '/p1' : '/p2'));
    const s1 = startedFor(1)[0];
    const s2 = startedFor(2)[0];
    expect(s1).not.toBe(s2);

    s1.emit({ type: 'text_delta', delta: 'A' });
    s2.emit({ type: 'text_delta', delta: 'B' });

    const c1 = runtimeEvents.filter((e) => e.conversationId === 1 && e.event.type === 'text');
    const c2 = runtimeEvents.filter((e) => e.conversationId === 2 && e.event.type === 'text');
    expect(c1.map((e) => e.event.text)).toEqual(['A']);
    expect(c2.map((e) => e.event.text)).toEqual(['B']);
  });

  it('兼容方法存在：setPermissionPolicy / setMode / setConfigOption / respondPermission 不抛', async () => {
    const { registry } = makeRegistry();
    await registry.connect({ ...baseConnect });
    expect(() => registry.setPermissionPolicy('tiered')).not.toThrow();
    await expect(registry.setMode(1, 'm')).resolves.toBeUndefined();
    await expect(registry.setConfigOption(1, 'c', 'v')).resolves.toBeUndefined();
    await expect(registry.respondPermission(1, 'r', 'o')).resolves.toBeUndefined();
  });
});
