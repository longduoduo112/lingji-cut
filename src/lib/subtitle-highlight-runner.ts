import type { SrtEntry, SubtitleHighlight } from '../types';
import type { AISettings } from '../types/ai';
import {
  buildSubtitleHighlightSystemPrompt,
  buildSubtitleHighlightUserMessage,
} from './subtitle-highlight-ai';
import { generateStructuredData } from './llm';
import { parseSubtitleHighlightResponse } from './subtitle-highlight-service';

interface GenerateSubtitleHighlightsOptions {
  batchSize?: number;
  generateStructuredData?: typeof generateStructuredData;
}

export async function generateSubtitleHighlights(
  entries: SrtEntry[],
  settings: AISettings,
  options: GenerateSubtitleHighlightsOptions = {},
): Promise<SubtitleHighlight[]> {
  if (entries.length === 0) {
    return [];
  }

  const batchSize = Math.max(1, options.batchSize ?? 30);
  const requestStructuredData = options.generateStructuredData ?? generateStructuredData;
  const systemPrompt = buildSubtitleHighlightSystemPrompt();
  const highlights: SubtitleHighlight[] = [];

  try {
    for (let index = 0; index < entries.length; index += batchSize) {
      const batch = entries.slice(index, index + batchSize);
      const payload = await requestStructuredData(
        settings,
        systemPrompt,
        buildSubtitleHighlightUserMessage(batch),
      );
      highlights.push(...parseSubtitleHighlightResponse(payload, batch));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`字幕关键词高亮生成失败：${message}`);
  }

  return highlights;
}
