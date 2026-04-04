import { describe, expect, it } from 'vitest';
import type { SrtEntry, SubtitleHighlight } from '../src/types';
import {
  filterValidSubtitleHighlights,
  isExpiredSubtitleHighlight,
  isValidSubtitleHighlight,
} from '../src/lib/subtitle-highlights';

function createEntry(overrides: Partial<SrtEntry> = {}): SrtEntry {
  return {
    index: 1,
    startMs: 0,
    endMs: 2_000,
    text: '中国品牌首次拿下世界冠军',
    ...overrides,
  };
}

function createHighlight(overrides: Partial<SubtitleHighlight> = {}): SubtitleHighlight {
  return {
    entryIndex: 1,
    start: 8,
    end: 12,
    highlightText: '世界冠军',
    sourceText: '中国品牌首次拿下世界冠军',
    ...overrides,
  };
}

describe('subtitle highlight helpers', () => {
  it('accepts a highlight when the slice matches the source text', () => {
    expect(isValidSubtitleHighlight(createEntry(), createHighlight())).toBe(true);
  });

  it('rejects a highlight when the coordinates do not match the text slice', () => {
    expect(
      isValidSubtitleHighlight(
        createEntry(),
        createHighlight({
          start: 2,
          end: 6,
          highlightText: '世界冠军',
        }),
      ),
    ).toBe(false);
  });

  it('marks a highlight as expired when the subtitle text changes', () => {
    expect(
      isExpiredSubtitleHighlight(
        createEntry({
          text: '中国品牌终于拿下世界冠军',
        }),
        createHighlight(),
      ),
    ).toBe(true);
  });

  it('filters out invalid and expired highlights', () => {
    const entries = [
      createEntry(),
      createEntry({
        index: 2,
        text: '第二句没有保留原文',
      }),
    ];
    const highlights = [
      createHighlight(),
      createHighlight({
        entryIndex: 2,
        sourceText: '第二句原文',
      }),
      createHighlight({
        entryIndex: 99,
      }),
    ];

    expect(filterValidSubtitleHighlights(entries, highlights)).toEqual([createHighlight()]);
  });
});
