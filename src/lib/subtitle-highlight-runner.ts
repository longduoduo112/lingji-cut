import type { SrtEntry, SubtitleHighlight } from '../types';
import type { AISettings } from '../types/ai';
import {
  buildSubtitleHighlightSystemPrompt,
  buildSubtitleHighlightUserMessage,
} from './subtitle-highlight-ai';
import { generateStructuredData } from './llm';
import { parseSubtitleHighlightResponse } from './subtitle-highlight-service';

export interface SubtitleHighlightProgress {
  batchIndex: number;
  batchTotal: number;
  processedEntries: number;
  totalEntries: number;
  percent: number;
}

interface GenerateSubtitleHighlightsOptions {
  batchSize?: number;
  generateStructuredData?: typeof generateStructuredData;
  onProgress?: (progress: SubtitleHighlightProgress) => void;
  shouldCancel?: () => boolean;
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
  const batchTotal = Math.ceil(entries.length / batchSize);

  options.onProgress?.({
    batchIndex: 0,
    batchTotal,
    processedEntries: 0,
    totalEntries: entries.length,
    percent: 0,
  });

  try {
    for (let index = 0; index < entries.length; index += batchSize) {
      if (options.shouldCancel?.()) {
        return highlights;
      }
      const batch = entries.slice(index, index + batchSize);
      const payload = await requestStructuredData(
        settings,
        systemPrompt,
        buildSubtitleHighlightUserMessage(batch),
      );
      highlights.push(...parseSubtitleHighlightResponse(payload, batch));

      const processed = Math.min(entries.length, index + batch.length);
      const batchIndex = Math.floor(index / batchSize) + 1;
      options.onProgress?.({
        batchIndex,
        batchTotal,
        processedEntries: processed,
        totalEntries: entries.length,
        percent: Math.round((processed / entries.length) * 100),
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`字幕关键词高亮生成失败：${message}`);
  }

  return highlights;
}
