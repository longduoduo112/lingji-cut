import type { AISettings } from '../types/ai';

export interface ChatRequest {
  url: string;
  headers: Record<string, string>;
  body: {
    model: string;
    messages: Array<{ role: 'system' | 'user'; content: string }>;
    response_format: { type: 'json_object' };
    temperature: number;
  };
}

export function buildChatRequest(
  settings: AISettings,
  systemPrompt: string,
  userMessage: string,
): ChatRequest {
  const baseUrl = settings.llmBaseUrl.replace(/\/+$/, '');

  return {
    url: `${baseUrl}/chat/completions`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.llmApiKey}`,
    },
    body: {
      model: settings.llmModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    },
  };
}

export function parseLLMJsonResponse(content: string): Record<string, unknown> | null {
  const normalized = content.trim();
  if (!normalized) {
    return null;
  }

  try {
    return JSON.parse(normalized) as Record<string, unknown>;
  } catch {
    const codeBlockMatch = normalized.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
    if (!codeBlockMatch) {
      return null;
    }

    try {
      return JSON.parse(codeBlockMatch[1].trim()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

export async function callLLM(
  settings: AISettings,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const request = buildChatRequest(settings, systemPrompt, userMessage);
  const response = await fetch(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(request.body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`LLM API error ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } | null } | null>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('LLM 返回空内容');
  }

  return content;
}
