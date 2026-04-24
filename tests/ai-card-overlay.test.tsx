import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AICardOverlay } from '../src/remotion/AICardOverlay';
import type { OverlayItem } from '../src/types';

vi.mock('remotion', () => ({
  Sequence: ({ children }: { children: unknown }) => children,
  getRemotionEnvironment: () => ({
    isRendering: false,
    isPlayer: false,
    isStudio: false,
    isReadOnlyStudio: false,
    isClientSideRendering: false,
  }),
  useCurrentFrame: () => 0,
  useVideoConfig: () => ({
    fps: 30,
    width: 1920,
    height: 1080,
    durationInFrames: 150,
    defaultCodec: null,
  }),
  delayRender: () => 0,
  continueRender: () => {},
}));

describe('AICardOverlay', () => {
  it('renders the summary card template for ai-card overlays', () => {
    const overlay: OverlayItem = {
      id: 'ai-overlay-1',
      type: 'image',
      assetPath: '',
      trackId: 'visual-1',
      startMs: 0,
      durationMs: 5_000,
      position: { x: 0, y: 0, width: 1_920, height: 1_080 },
      overlayType: 'ai-card',
      aiCardData: {
        cardType: 'summary',
        title: '本期要点',
        content: '要点一',
        template: 'summary-default',
        displayMode: 'fullscreen',
        style: {
          primaryColor: '#6366f1',
          backgroundColor: '#0f172a',
          fontSize: 48,
        },
      },
    };

    const html = renderToStaticMarkup(<AICardOverlay overlay={overlay} fps={30} />);

    expect(html).toContain('SUMMARY');
    expect(html).toContain('本期要点');
    expect(html).toContain('要点一');
  });

  it('falls back to legacy card rendering when motion-card payload is missing', () => {
    const overlay: OverlayItem = {
      id: 'ai-overlay-2',
      type: 'image',
      assetPath: '',
      trackId: 'visual-1',
      startMs: 0,
      durationMs: 5_000,
      position: { x: 0, y: 0, width: 1_920, height: 1_080 },
      overlayType: 'ai-card',
      aiCardData: {
        sourceCardId: 'card-2',
        cardType: 'quote',
        title: 'Motion 卡片',
        content: '重点内容',
        template: 'quote-default',
        displayMode: 'fullscreen',
        renderMode: 'motion-card',
        style: {
          primaryColor: '#ec4899',
          backgroundColor: '#0f172a',
          fontSize: 48,
        },
      },
    };

    const html = renderToStaticMarkup(<AICardOverlay overlay={overlay} fps={30} />);

    // motionCard 没有 compiledCode → 分发层直接落回 QuoteCard（legacy 渲染）
    expect(html).not.toContain('<iframe');
    expect(html).toContain('重点内容');
  });
});
