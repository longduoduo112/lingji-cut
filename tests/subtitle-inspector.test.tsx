import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SubtitleInspector } from '../src/components/SubtitleInspector';

vi.mock('../src/store/timeline', () => ({
  useTimelineStore: () => ({
    srtEntries: [{ index: 1, startMs: 0, endMs: 2_000, text: 'hello world' }],
    setSubtitleHighlights: () => undefined,
    updateSubtitleStyle: () => undefined,
    timeline: {
      podcast: {
        srtPath: '/tmp/test.srt',
      },
      subtitleHighlights: [],
      subtitle: {
        fontSize: 48,
        color: '#FFFFFF',
        position: 'bottom',
        highlightEnabled: true,
        highlightBackgroundColor: '#F8DC48',
        highlightTextColor: '#111827',
        highlightPaddingX: 10,
        highlightPaddingY: 4,
        highlightRadius: 12,
        highlightAnimation: 'pop',
      },
    },
  }),
}));

describe('SubtitleInspector', () => {
  it('renders subtitle highlight controls inside the right inspector', () => {
    const html = renderToStaticMarkup(<SubtitleInspector />);

    expect(html).toContain('关键词高亮样式');
    expect(html).toContain('生成高亮');
    expect(html).toContain('启用关键词高亮');
    expect(html).toContain('高亮底色');
    expect(html).toContain('高亮动画');
    expect(html).toContain('世界冠军');
    expect(html).toContain('test.srt');
  });
});
