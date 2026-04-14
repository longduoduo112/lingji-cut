import { describe, expect, it } from 'vitest';
import {
  STORYBOARD_MOTION_CARD_ID_PREFIX,
  buildMotionPromptFromSuggestion,
  buildStoryboardMotionCardDrafts,
  isStoryboardMotionCardId,
  selectMotionEligibleSuggestions,
} from '../src/lib/motion-autogen';
import type {
  AISegmentAnalysis,
  AIStoryboardPlan,
  AIVisualSuggestion,
} from '../src/types/ai';

function makeSegment(overrides: Partial<AISegmentAnalysis> = {}): AISegmentAnalysis {
  return {
    id: 'segment-1',
    title: '营收增长',
    summary: '同比上涨 12%',
    startMs: 0,
    endMs: 4_000,
    semanticType: 'data',
    complexityLevel: 'medium',
    visualizationScore: 90,
    pacingNeed: 'accent',
    keywords: ['营收', '增长'],
    entities: ['利润率'],
    ...overrides,
  };
}

function makeSuggestion(overrides: Partial<AIVisualSuggestion> = {}): AIVisualSuggestion {
  return {
    id: 'visual-segment-1',
    segmentId: 'segment-1',
    suggestionType: 'data-motion',
    priority: 9,
    reason: '这段数据值得动画强调',
    enabled: true,
    startMs: 0,
    endMs: 4_000,
    displayDurationMs: 4_000,
    displayMode: 'fullscreen',
    templateKey: 'kpi-countup',
    visualBrief: '营收增长：同比上涨 12%',
    autoApplyEligible: true,
    ...overrides,
  };
}

function makePlan(
  suggestions: AIVisualSuggestion[],
  segments: AISegmentAnalysis[] = [],
): AIStoryboardPlan {
  return {
    segments,
    suggestions,
    summary: '',
    generatedAt: 0,
  };
}

describe('motion-autogen', () => {
  it('filters out content-card suggestions from motion generation', () => {
    const plan = makePlan([
      makeSuggestion({ id: 'visual-1', suggestionType: 'data-motion' }),
      makeSuggestion({ id: 'visual-2', suggestionType: 'content-card' }),
      makeSuggestion({ id: 'visual-3', suggestionType: 'explainer-motion' }),
      makeSuggestion({ id: 'visual-4', suggestionType: 'chapter-transition' }),
    ]);

    const eligible = selectMotionEligibleSuggestions(plan);

    expect(eligible).toHaveLength(3);
    expect(eligible.map((item) => item.suggestionType)).toEqual([
      'data-motion',
      'explainer-motion',
      'chapter-transition',
    ]);
  });

  it('builds prompts that mention display mode, duration, brief and reason', () => {
    const segment = makeSegment();
    const suggestion = makeSuggestion();

    const prompt = buildMotionPromptFromSuggestion(suggestion, segment);

    expect(prompt).toContain('16:9 全屏');
    // data-motion 固定使用 5 秒，与卡片展示时长（displayDurationMs）解耦
    expect(prompt).toContain('5 秒');
    expect(prompt).toContain('营收增长');
    expect(prompt).toContain('kpi-countup');
    expect(prompt).toContain('利润率');
    expect(prompt).toContain('这段数据值得动画强调');
  });

  it('produces draft motion cards with stable storyboard- prefixed ids', () => {
    const plan = makePlan(
      [
        makeSuggestion({ id: 'visual-1', suggestionType: 'data-motion' }),
        makeSuggestion({ id: 'visual-2', suggestionType: 'content-card' }),
      ],
      [makeSegment()],
    );

    const drafts = buildStoryboardMotionCardDrafts(plan);

    expect(drafts).toHaveLength(1);
    const [draft] = drafts;

    expect(draft.card.id.startsWith(STORYBOARD_MOTION_CARD_ID_PREFIX)).toBe(true);
    expect(isStoryboardMotionCardId(draft.card.id)).toBe(true);
    expect(draft.card.type).toBe('motion');
    expect(draft.card.renderMode).toBe('motion-card');
    expect(draft.card.template).toBe('motion-kpi-countup');
    expect(draft.card.title).toBe('营收增长');
    expect(draft.card.enabled).toBe(true);
    expect(draft.card.motionCard?.prompt).toBe(draft.prompt);
    expect(draft.card.motionCard?.sourceCode).toBe('');
    expect(draft.card.motionCard?.compiledCode).toBe('');
    expect(draft.prompt).toContain('营收增长');
  });

  it('treats manually created motion cards as non-storyboard ids', () => {
    expect(isStoryboardMotionCardId('motion-1700000000-42')).toBe(false);
    expect(isStoryboardMotionCardId('storyboard-motion-visual-7')).toBe(true);
  });
});
