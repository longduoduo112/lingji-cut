/**
 * pi-rpc.ts
 *
 * Pi JSON-RPC 协议解析器（对齐真实 `pi --mode rpc` 协议）。
 *
 * Pi 是双向 JSON-RPC 方言：stdin 发命令，stdout 读事件。每行一条 JSON。
 *
 * 命令形状（出站，stdin）：`{ id, type, ...params }`
 *   - prompt:       { id, type:'prompt', message }
 *   - new_session:  { id, type:'new_session', parentSession }
 *   - abort:        { id, type:'abort' }
 *   - 扩展 UI 应答: { type:'extension_ui_response', id, ...result }
 *
 * 事件形状（入站，stdout）：`{ type, ... }`
 *   - agent_start / turn_start / message_update(assistantMessageEvent) /
 *     tool_execution_start / tool_execution_end / turn_end / agent_end /
 *     extension_ui_request / response(命令回执) …
 *
 * 关键：pi 在需要确认（写文件/跑命令等）时会发 `extension_ui_request` 并**阻塞**
 * 等待 `extension_ui_response`。桌面端没有 pi 自带对话框的承载面，必须自动应答，
 * 否则整轮卡死、表现为「requested permissions … but you haven't granted it yet」。
 * 与参考实现 open-design 的 replyExtensionUi 一致：confirm→true，select→首项。
 */

import type { AgentStreamEvent } from '../event-model';
import { createJsonLineStream } from './line-stream';

// ─── 工具 ────────────────────────────────────────────────────────────────────

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : undefined;
}

function firstNumber(...vals: unknown[]): number | undefined {
  for (const v of vals) if (typeof v === 'number') return v;
  return undefined;
}

/** pi 的 fire-and-forget 扩展方法：无需应答，静默消费。 */
const FIRE_AND_FORGET_METHODS = new Set([
  'setStatus',
  'setWidget',
  'notify',
  'setTitle',
  'set_editor_text',
]);

/** 从 tool_execution_end 抽取文本内容：result.content[] → output → result。 */
function extractToolContent(r: Record<string, unknown>): string {
  const result = asRecord(r['result']);
  const content = result?.['content'];
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        const item = asRecord(c);
        return item?.['type'] === 'text' ? String(item['text'] ?? '') : JSON.stringify(c);
      })
      .join('\n');
  }
  const rawOut = r['output'] ?? r['result'];
  return typeof rawOut === 'string' ? rawOut : JSON.stringify(rawOut ?? null);
}

// ─── 纯映射层 ──────────────────────────────────────────────────────────────────

export type PiMapResult = { event?: AgentStreamEvent; signal?: 'agent_end' };

/**
 * 把 Pi RPC 的一条原始事件对象映射成 AgentStreamEvent 或控制信号。
 *
 * 容错：未知 type 返回 {}（安静忽略）；字段缺失走兜底。
 * message_update 优先读真实字段 `assistantMessageEvent`，兼容旧的 `event`。
 */
export function mapPiRpcEvent(raw: unknown): PiMapResult {
  const r = asRecord(raw);
  if (!r) return {};
  const type = r['type'];

  switch (type) {
    case 'agent_start':
    case 'turn_start':
      return { event: { type: 'status', label: 'working' } };

    case 'message_update': {
      const inner = asRecord(r['assistantMessageEvent']) ?? asRecord(r['event']);
      if (!inner) return {};
      const innerType = inner['type'];

      if (innerType === 'text_delta') {
        return { event: { type: 'text_delta', delta: (inner['delta'] as string) ?? '' } };
      }
      if (innerType === 'thinking_delta') {
        return { event: { type: 'thinking_delta', delta: (inner['delta'] as string) ?? '' } };
      }
      if (innerType === 'thinking_start') {
        return { event: { type: 'thinking_start' } };
      }
      if (innerType === 'thinking_end') {
        return { event: { type: 'thinking_end' } };
      }
      if (innerType === 'error') {
        const message =
          (inner['reason'] as string) ||
          (inner['message'] as string) ||
          (inner['delta'] as string) ||
          'unknown error';
        return { event: { type: 'error', message, raw: JSON.stringify(raw) } };
      }
      return {};
    }

    case 'tool_execution_start': {
      const id = (r['toolCallId'] as string | undefined) ?? '';
      // 真实字段 toolName；对字段命名差异做容错。
      const name =
        (r['toolName'] as string | undefined) ??
        (r['tool_name'] as string | undefined) ??
        (r['name'] as string | undefined) ??
        '';
      const input = r['args'] ?? r['input'] ?? null;
      return { event: { type: 'tool_use', id, name, input } };
    }

    case 'tool_execution_end': {
      const toolUseId = (r['toolCallId'] as string | undefined) ?? '';
      const content = extractToolContent(r);
      const isError = (r['isError'] as boolean | undefined) ?? false;
      return { event: { type: 'tool_result', toolUseId, content, isError } };
    }

    case 'turn_end': {
      const message = asRecord(r['message']);
      const usageObj = asRecord(message?.['usage']) ?? asRecord(r['usage']);
      // 真实字段 input/output（+ inputTokens/outputTokens 兼容旧推断）。
      const inputTokens = firstNumber(usageObj?.['input'], usageObj?.['inputTokens']);
      const outputTokens = firstNumber(usageObj?.['output'], usageObj?.['outputTokens']);
      const cost = asRecord(usageObj?.['cost']);
      const costUsd = firstNumber(cost?.['total'], cost?.['totalCost'], usageObj?.['costUsd']);
      const durationMs = firstNumber(usageObj?.['durationMs']);
      return {
        event: { type: 'usage', inputTokens, outputTokens, costUsd, durationMs },
      };
    }

    case 'message_end':
      // usage 已由 turn_end、工具块已由 tool_execution_* 发出，无需重复。
      return {};

    case 'extension_error': {
      const message = (r['error'] as string) || 'Extension error';
      return { event: { type: 'error', message, raw: JSON.stringify(raw) } };
    }

    case 'agent_end':
      return { signal: 'agent_end' };

    default:
      return {};
  }
}

// ─── 会话壳 ───────────────────────────────────────────────────────────────────

export interface PiRpcSessionDeps {
  /** 可注入 fake child，便于测试 */
  child: {
    stdout: NodeJS.ReadableStream;
    stdin: NodeJS.WritableStream;
  };
  prompt: string;
  cwd?: string;
  model?: string;
  /**
   * parentSession：有值时先发 new_session{parentSession}，待 pi 回执确认后再发
   * prompt（resume 的 prompt 只含最新一轮，父会话加载失败若继续会丢历史上下文）。
   */
  parentSession?: string | null;
  onEvent: (ev: AgentStreamEvent) => void;
}

export interface PiRpcSession {
  dispose(): void;
  /** 发送 RPC abort，让 pi 优雅停止当前轮（SIGTERM 兜底由调用方负责）。 */
  abort(): void;
}

/**
 * createPiRpcSession
 *
 * 连接 child 进程 stdio，驱动 mapPiRpcEvent，将归一化事件路由到 onEvent。
 * 自动应答 extension_ui_request（否则 pi 阻塞）；signal:'agent_end' 时 emit turn_end。
 */
export function createPiRpcSession(deps: PiRpcSessionDeps): PiRpcSession {
  const { child, prompt, parentSession, onEvent } = deps;
  const stdin = child.stdin;

  let finished = false;
  let stdinOpen = true;
  let nextRpcId = 1;
  let parentSessionRpcId: number | null = null;
  let promptRpcId: number | null = null;

  function sendCommand(type: string, params: Record<string, unknown> = {}): number | null {
    if (!stdinOpen) return null;
    const id = nextRpcId++;
    try {
      stdin.write(JSON.stringify({ id, type, ...params }) + '\n');
    } catch {
      // EPIPE 等：忽略（进程可能已退出）
    }
    return id;
  }

  function sendPromptCommand(): void {
    promptRpcId = sendCommand('prompt', { message: prompt });
  }

  /** 自动应答 pi 的扩展 UI 请求，保持 pi 不阻塞。 */
  function replyExtensionUi(raw: Record<string, unknown>): void {
    if (raw['id'] == null) return;
    const method = raw['method'];
    // fire-and-forget：无需应答。
    if (typeof method === 'string' && FIRE_AND_FORGET_METHODS.has(method)) return;

    let result: Record<string, unknown>;
    if (method === 'confirm') {
      result = { confirmed: true };
    } else {
      const params = asRecord(raw['params']);
      const opts = (params?.['options'] ?? raw['options']) as unknown;
      if (Array.isArray(opts) && opts.length > 0) {
        const first = opts[0];
        result =
          typeof first === 'string'
            ? { value: first }
            : { value: asRecord(first)?.['label'] ?? asRecord(first)?.['value'] ?? '' };
      } else {
        result = { cancelled: true };
      }
    }
    if (!stdinOpen) return;
    try {
      stdin.write(JSON.stringify({ type: 'extension_ui_response', id: raw['id'], ...result }) + '\n');
    } catch {
      // 忽略写入失败
    }
  }

  const lineStream = createJsonLineStream({
    onJson: (obj) => {
      const r = asRecord(obj);
      if (!r) return;
      if (finished) return;

      // 扩展 UI 请求：自动应答，避免 pi 阻塞导致整轮卡死。
      if (r['type'] === 'extension_ui_request') {
        replyExtensionUi(r);
        return;
      }

      // RPC 命令回执（prompt / new_session 的 ack）：非 agent 事件。
      if (r['type'] === 'response') {
        if (r['id'] === parentSessionRpcId) {
          if (r['success'] === false) {
            finished = true;
            onEvent({
              type: 'error',
              message: `parent session rejected: ${String(r['error'] ?? 'unknown')}`,
            });
            return;
          }
          // 父会话已加载：现在才发 prompt。
          sendPromptCommand();
          return;
        }
        if (r['id'] === promptRpcId && r['success'] === false) {
          finished = true;
          onEvent({ type: 'error', message: `prompt rejected: ${String(r['error'] ?? 'unknown')}` });
        }
        return;
      }

      const result = mapPiRpcEvent(r);
      if (result.event) {
        onEvent(result.event);
      }
      if (result.signal === 'agent_end') {
        finished = true;
        onEvent({ type: 'turn_end' });
      }
    },
    onRaw: (_line) => {
      // 非 JSON 行静默忽略（Pi stdout 应全为 JSON）
    },
  });

  function onData(chunk: string | Buffer): void {
    lineStream.feed(chunk);
  }
  function onEnd(): void {
    lineStream.flush();
  }

  child.stdout.on('data', onData);
  child.stdout.on('end', onEnd);

  // 出站：有 parentSession 先建会话（等回执再发 prompt），否则直接发 prompt。
  if (parentSession) {
    parentSessionRpcId = sendCommand('new_session', { parentSession });
  } else {
    sendPromptCommand();
  }

  function dispose(): void {
    stdinOpen = false;
    child.stdout.off('data', onData);
    child.stdout.off('end', onEnd);
  }

  function abort(): void {
    if (finished) return;
    finished = true;
    sendCommand('abort');
  }

  return { dispose, abort };
}
