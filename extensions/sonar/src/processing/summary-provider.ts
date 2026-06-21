/**
 * Summary Provider 契约与实现（设计文档 4.6 / 8.1）。
 *
 * 接收转录文本，调用 LLM 产出结构化 VideoAnalysis（经 validateAnalysis 运行时校验）。
 * 支持两种协议（见 domain/models 的 LlmProtocol）：
 * - 'openai'：POST {baseUrl}/chat/completions（json_object 输出）
 * - 'anthropic'：POST {baseUrl}/v1/messages（Anthropic Messages，含 MiniMax anthropic 端点）
 *
 * 错误：SUMMARY_FAILED（请求失败 / 响应非 ok）/ SUMMARY_INVALID_RESPONSE（非法 JSON 或不合 schema）。
 */
import type { LlmProtocol, TranscriptDocument, VideoAnalysis } from '@/domain/models';
import { VIDEO_CATEGORIES } from '@/domain/models';
import { SonarException, makeError } from '@/domain/errors';
import { validateAnalysis } from './summary';

export interface SummaryConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** 默认 'openai'。 */
  protocol?: LlmProtocol;
  temperature?: number;
  maxInputChars?: number;
  timeoutMs?: number;
}

export interface SummaryProvider {
  summarize(transcript: TranscriptDocument, opts: { videoId: string }): Promise<VideoAnalysis>;
}

export interface SummaryProviderDeps {
  fetchImpl?: typeof fetch;
  now?: () => number;
}

const DEFAULT_MAX_INPUT = 12000;
const DEFAULT_TEMPERATURE = 0.3;

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/** 读取响应体文本用于错误展示；缺少 text() 或读取失败时回退空串（不掩盖原始状态码）。 */
async function safeErrorBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.trim().slice(0, 300);
  } catch {
    return '';
  }
}

/** 去除 ```json 围栏 / 提取最外层 {...}，容忍模型未严格只输出 JSON 的情况。 */
function parseLooseJson(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const body = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(body.slice(start, end + 1));
    }
    throw new SonarException(makeError('SUMMARY_INVALID_RESPONSE', '摘要内容不是合法 JSON'));
  }
}

function systemPrompt(): string {
  return [
    '你是中文短视频内容分析助手。阅读口播转录文本，输出严格的 JSON 对象，字段：',
    `- category：必须是以下之一：${VIDEO_CATEGORIES.join('、')}`,
    '- summary：100–200 字中文摘要',
    '- keyPoints：3–6 条关键要点（字符串数组）',
    '- tags：3–8 个话题标签（不带 # 的字符串数组）',
    '只输出 JSON，不要额外文字。',
  ].join('\n');
}

/** OpenAI 兼容：chat/completions，返回模型输出文本（应为 JSON 字符串）。 */
async function callOpenAi(
  fetchImpl: typeof fetch,
  config: SummaryConfig,
  text: string,
): Promise<string> {
  const request = (jsonMode: boolean): Promise<Response> => {
    const body: Record<string, unknown> = {
      model: config.model,
      temperature: config.temperature ?? DEFAULT_TEMPERATURE,
      messages: [
        { role: 'system', content: systemPrompt() },
        { role: 'user', content: text },
      ],
    };
    // response_format 仅部分 OpenAI 兼容端点支持；不支持的（如火山方舟 Coding）会返回 400。
    if (jsonMode) body.response_format = { type: 'json_object' };
    return fetchImpl(joinUrl(config.baseUrl, 'chat/completions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });
  };

  let res = await request(true);
  // 400 多半是参数不被接受：去掉 response_format 重试一次（提示词已要求只输出 JSON，
  // 解析时再容忍 ``` 围栏 / 前后缀文字）。其它状态码（401/403/429/5xx）不重试。
  if (res.status === 400) {
    res = await request(false);
  }
  if (!res.ok) {
    const detail = await safeErrorBody(res);
    throw new SonarException(
      makeError('SUMMARY_FAILED', `摘要失败（HTTP ${res.status}）${detail ? `：${detail}` : ''}`, {
        retryable: true,
      }),
    );
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new SonarException(makeError('SUMMARY_INVALID_RESPONSE', '摘要响应缺少内容'));
  }
  return content;
}

/** Anthropic Messages：v1/messages，返回首个 text block。 */
async function callAnthropic(
  fetchImpl: typeof fetch,
  config: SummaryConfig,
  text: string,
): Promise<string> {
  const res = await fetchImpl(joinUrl(config.baseUrl, 'v1/messages'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      // 允许浏览器/扩展环境直连（CORS）。
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1024,
      temperature: config.temperature ?? DEFAULT_TEMPERATURE,
      system: systemPrompt(),
      messages: [{ role: 'user', content: text }],
    }),
  });
  if (!res.ok) {
    const detail = await safeErrorBody(res);
    throw new SonarException(
      makeError('SUMMARY_FAILED', `摘要失败（HTTP ${res.status}）${detail ? `：${detail}` : ''}`, {
        retryable: true,
      }),
    );
  }
  const json = (await res.json()) as { content?: Array<{ type?: string; text?: unknown }> };
  const block = json.content?.find((b) => b.type === 'text') ?? json.content?.[0];
  const content = block?.text;
  if (typeof content !== 'string') {
    throw new SonarException(makeError('SUMMARY_INVALID_RESPONSE', '摘要响应缺少内容'));
  }
  return content;
}

export function createSummaryProvider(
  config: SummaryConfig,
  deps: SummaryProviderDeps = {},
): SummaryProvider {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const now = deps.now ?? (() => Date.now());
  const maxInput = config.maxInputChars ?? DEFAULT_MAX_INPUT;
  const protocol = config.protocol ?? 'openai';

  return {
    async summarize(transcript, opts) {
      const text = transcript.fullText.slice(0, maxInput);
      let content: string;
      try {
        content =
          protocol === 'anthropic'
            ? await callAnthropic(fetchImpl, config, text)
            : await callOpenAi(fetchImpl, config, text);
      } catch (e) {
        if (e instanceof SonarException) throw e;
        throw new SonarException(
          makeError('SUMMARY_FAILED', '摘要请求失败', {
            retryable: true,
            detail: e instanceof Error ? e.message : String(e),
          }),
        );
      }

      let parsed: unknown;
      try {
        parsed = parseLooseJson(content);
      } catch (e) {
        if (e instanceof SonarException) throw e;
        throw new SonarException(makeError('SUMMARY_INVALID_RESPONSE', '摘要内容不是合法 JSON'));
      }
      return validateAnalysis(parsed, { videoId: opts.videoId, model: config.model, now: now() });
    },
  };
}

/** @deprecated 用 createSummaryProvider（按 config.protocol 选择协议）。保留别名兼容既有调用与测试。 */
export const createOpenAiSummaryProvider = createSummaryProvider;
