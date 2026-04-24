import { jsonrepair } from 'jsonrepair';

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// 在原文中"找到第一个 { 之后的所有内容"，配合 jsonrepair 处理被截断 / 含尾随说明文字 / 缺闭合的情况
function sliceFromFirstBrace(content: string): string | null {
  const idx = content.indexOf('{');
  return idx >= 0 ? content.slice(idx) : null;
}

function parseJsonRecord(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isJsonRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extractFirstJsonObject(content: string): string | null {
  let start = -1;
  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (start < 0) {
      if (char === '{') {
        start = index;
        depth = 1;
        inString = false;
        isEscaped = false;
      }
      continue;
    }

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }
      if (char === '\\') {
        isEscaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char !== '}') {
      continue;
    }

    depth -= 1;
    if (depth === 0) {
      return content.slice(start, index + 1);
    }
  }

  return null;
}

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

  const direct = parseJsonRecord(normalized);
  if (direct) {
    return direct;
  }

  const codeBlockMatch = normalized.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  if (codeBlockMatch) {
    const fenced = parseJsonRecord(codeBlockMatch[1].trim());
    if (fenced) {
      return fenced;
    }
  }

  const extractedObject = extractFirstJsonObject(normalized);
  if (extractedObject) {
    const fromExtracted = parseJsonRecord(extractedObject);
    if (fromExtracted) {
      return fromExtracted;
    }
  }

  // 兜底：jsonrepair 修复（处理被 max_tokens 截断、单引号、尾逗号、未转义换行等）
  const repairCandidates = [extractedObject, sliceFromFirstBrace(normalized), normalized].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
  for (const candidate of repairCandidates) {
    try {
      const repaired = jsonrepair(candidate);
      const parsed = parseJsonRecord(repaired);
      if (parsed) {
        return parsed;
      }
    } catch {
      // try next candidate
    }
  }

  return null;
}

export function parseStructuredOutput(content: string): Record<string, unknown> {
  const parsed = parseLLMJsonResponse(content);
  if (!parsed) {
    throw new Error('LLM 未返回有效的 JSON 对象');
  }

  return parsed;
}
