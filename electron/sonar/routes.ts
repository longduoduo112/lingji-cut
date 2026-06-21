/**
 * 声呐桥路由（设计文档第 5 节）。
 *
 * 纯处理器：归一化请求 → { status, body }，与 node http 解耦，便于单测。
 * server.ts 写一层薄适配把 IncomingMessage/ServerResponse 接进来。
 * 仅 loopback（由 server 绑定保证）+ x-sonar-token 比对。
 */
import type { SonarInboxStore, SonarEnqueueInput } from './inbox-store';

export interface SonarRequest {
  method: string;
  /** URL pathname，例如 /sonar/enqueue */
  path: string;
  /** x-sonar-token 头 */
  token?: string;
  /** 已解析的 JSON body */
  body?: unknown;
}

export interface SonarResponse {
  status: number;
  body: unknown;
}

export interface SonarRouteDeps {
  store: SonarInboxStore;
  expectedToken: string;
  version?: string;
}

/** 该 path 是否归声呐桥处理（server.ts 用它决定是否接管）。 */
export function isSonarPath(path: string): boolean {
  return path === '/sonar' || path.startsWith('/sonar/');
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function validateEnqueue(body: unknown): { ok: true; input: SonarEnqueueInput } | { ok: false; message: string } {
  if (!body || typeof body !== 'object') return { ok: false, message: 'body 必须是对象' };
  const b = body as Record<string, unknown>;
  for (const field of ['source', 'awemeId', 'creatorId', 'creatorName', 'title', 'url']) {
    if (!isNonEmptyString(b[field])) return { ok: false, message: `字段 ${field} 缺失或非法` };
  }
  if (typeof b.publishedAt !== 'number') return { ok: false, message: '字段 publishedAt 缺失或非法' };
  const t = b.transcript as Record<string, unknown> | undefined;
  if (!t || typeof t !== 'object') return { ok: false, message: 'transcript 缺失' };
  if (!isNonEmptyString(t.fullText)) return { ok: false, message: 'transcript.fullText 缺失' };
  if (typeof t.srtText !== 'string') return { ok: false, message: 'transcript.srtText 缺失' };
  if (!Array.isArray(t.segments)) return { ok: false, message: 'transcript.segments 缺失' };
  return { ok: true, input: body as SonarEnqueueInput };
}

export async function handleSonarRequest(
  req: SonarRequest,
  deps: SonarRouteDeps,
): Promise<SonarResponse> {
  const { method, path } = req;

  if (path === '/sonar/health') {
    if (method !== 'GET') return { status: 405, body: { error: 'Method Not Allowed' } };
    return { status: 200, body: { ok: true, name: 'lingji-editor', version: deps.version ?? '1.0.0' } };
  }

  if (path === '/sonar/enqueue') {
    if (method !== 'POST') return { status: 405, body: { error: 'Method Not Allowed' } };
    if (!req.token || req.token !== deps.expectedToken) {
      return { status: 401, body: { error: 'Unauthorized' } };
    }
    const v = validateEnqueue(req.body);
    if (!v.ok) return { status: 400, body: { error: v.message } };
    const { item, duplicate } = await deps.store.enqueue(v.input);
    return { status: 200, body: { queued: true, itemId: item.id, duplicate } };
  }

  return { status: 404, body: { error: 'Not Found' } };
}
