export function extractTextContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map((item) => extractTextContent(item)).join('');
  }

  if (!content || typeof content !== 'object') {
    return '';
  }

  const record = content as Record<string, unknown>;

  if (typeof record.text === 'string') {
    return record.text;
  }

  if (typeof record.delta === 'string') {
    return record.delta;
  }

  if ('content' in record) {
    return extractTextContent(record.content);
  }

  if ('message' in record) {
    return extractTextContent(record.message);
  }

  if ('output' in record) {
    return extractTextContent(record.output);
  }

  return '';
}

export function extractReasoningContent(content: unknown): string {
  if (typeof content === 'string') {
    return '';
  }

  if (Array.isArray(content)) {
    return content.map((item) => extractReasoningContent(item)).join('');
  }

  if (!content || typeof content !== 'object') {
    return '';
  }

  const record = content as Record<string, unknown>;

  if (typeof record.reasoning_content === 'string') {
    return record.reasoning_content;
  }

  if (typeof record.reasoning === 'string') {
    return record.reasoning;
  }

  return [record.additional_kwargs, record.response_metadata, record.content, record.delta]
    .map((value) => extractReasoningContent(value))
    .join('');
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

export function parseStructuredOutput(content: string): Record<string, unknown> {
  const parsed = parseLLMJsonResponse(content);
  if (!parsed) {
    throw new Error('LLM 未返回有效的 JSON 对象');
  }

  return parsed;
}
