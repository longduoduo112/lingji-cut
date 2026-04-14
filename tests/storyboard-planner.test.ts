import { describe, expect, it, vi } from 'vitest';
import {
  buildStoryboardSuggestions,
  planStoryboardFromTranscript,
} from '../src/lib/storyboard-planner';

describe('storyboard planner', () => {
  it('creates data motion suggestion for high-score data segment', () => {
    const plan = buildStoryboardSuggestions([
      {
        id: 's1',
        startMs: 0,
        endMs: 4000,
        title: '增长数据',
        summary: '营收上涨',
        semanticType: 'data',
        complexityLevel: 'medium',
        visualizationScore: 90,
        pacingNeed: 'accent',
        keywords: ['增长'],
        entities: ['营收'],
      },
    ]);

    expect(plan.suggestions[0].suggestionType).toBe('data-motion');
  });

  it('can build storyboard suggestions independently from transcript planning', async () => {
    const planSegments = vi.fn().mockResolvedValue({
      segments: [
        {
          id: 'segment-1',
          startMs: 0,
          endMs: 5_000,
          title: '季度营收',
          summary: '解释营收与利润的变化',
          semanticType: 'data',
          complexityLevel: 'high',
          visualizationScore: 86,
          pacingNeed: 'accent',
          keywords: ['营收'],
          entities: ['利润率'],
        },
      ],
      coverPrompts: [],
      summary: '节目摘要',
      keywords: ['营收'],
      globalPrompt: '商业播客风格',
    });

    const plan = await planStoryboardFromTranscript(
      [{ index: 1, startMs: 0, endMs: 5_000, text: '营收同比上涨 12%，利润率提升 3 个点。' }],
      {
        llmProviders: [],
        defaultProviderId: null,
        defaultModel: null,
        llmBaseUrl: 'https://api.openai.com/v1',
        llmApiKey: 'sk-test',
        llmModel: 'gpt-4o-mini',
        jimengApiUrl: 'https://jimeng.example.com',
        jimengSessionId: 'session-id',
        minimaxApiKey: '',
        minimaxVoiceId: 'male-qn-qingse',
        minimaxSpeed: 1,
      },
      { planSegments },
    );

    expect(planSegments).toHaveBeenCalledTimes(1);
    expect(plan.summary).toBe('节目摘要');
    expect(plan.suggestions[0].suggestionType).toBe('data-motion');
  });
});
