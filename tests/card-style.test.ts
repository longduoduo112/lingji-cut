import { describe, expect, it } from 'vitest';
import { buildAICardOverlayData, getDefaultCardStyle, type AICard } from '../src/types/ai';

function makeCard(overrides: Partial<AICard> = {}): AICard {
  return {
    id: 'c1',
    segmentId: 's1',
    type: 'summary',
    title: 'T',
    content: '',
    startMs: 0,
    endMs: 1000,
    displayDurationMs: 5000,
    displayMode: 'fullscreen',
    template: 'summary-default',
    enabled: true,
    style: getDefaultCardStyle('summary'),
    ...overrides,
  };
}

describe('buildAICardOverlayData stylePresetId 透传', () => {
  it('保留单卡 stylePresetId', () => {
    const overlay = buildAICardOverlayData(makeCard({ stylePresetId: 'swiss-grid' }));
    expect(overlay.stylePresetId).toBe('swiss-grid');
  });

  it('未设置时为 undefined', () => {
    const overlay = buildAICardOverlayData(makeCard());
    expect(overlay.stylePresetId).toBeUndefined();
  });
});
