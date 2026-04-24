import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AICardInspector } from '../src/components/AICardInspector';

describe('AICardInspector', () => {
  const baseCardStyle = {
    primaryColor: '#6366f1',
    backgroundColor: '#0f172a',
    fontSize: 48,
  } as const;

  it('renders the design-aligned sections, motion state and danger zone', () => {
    const html = renderToStaticMarkup(
      <AICardInspector
        card={{
          id: 'card-1',
          segmentId: 'segment-1',
          type: 'summary',
          title: 'AI 驱动的未来',
          content: '人工智能正在改变我们的创作方式。',
          startMs: 0,
          endMs: 45_000,
          displayDurationMs: 5_000,
          displayMode: 'fullscreen',
          template: 'summary-default',
          enabled: true,
          style: baseCardStyle,
        }}
        onRegenerate={async () => null}
        onSave={() => undefined}
        onDelete={() => undefined}
      />,
    );

    expect(html).toContain('data-ai-card-section="text-content"');
    expect(html).toContain('data-ai-card-section="display-settings"');
    expect(html).toContain('data-ai-card-section="preview"');
    expect(html).toContain('data-ai-card-section="danger"');
    expect(html).toContain('文字内容');
    expect(html).toContain('展示设置');
    expect(html).toContain('Motion 卡片状态');
    expect(html).toContain('危险操作');
    expect(html).toContain('尚未生成 Motion 代码');
    expect(html).toContain('全屏模式');
    expect(html).toContain('重新生成');
    expect(html).toContain('保存');
    expect(html).toContain('删除此卡片');
  });

  it('shows "motion card ready" once compiled code is attached', () => {
    const html = renderToStaticMarkup(
      <AICardInspector
        card={{
          id: 'card-motion',
          segmentId: 'segment-1',
          type: 'summary',
          title: 'Motion 卡片',
          content: '人工智能正在改变我们的创作方式。',
          startMs: 0,
          endMs: 45_000,
          displayDurationMs: 5_000,
          displayMode: 'fullscreen',
          template: 'summary-default',
          enabled: true,
          renderMode: 'motion-card',
          motionCard: {
            sourceCode: 'const MotionComponent = (props) => null;',
            compiledCode: 'var MotionComponent = function(props){ return null; };',
            compiledAt: 1_715_000_000_000,
            prompt: 'test',
            retryCount: 0,
          },
          style: baseCardStyle,
        }}
        onRegenerate={async () => null}
        onSave={() => undefined}
        onDelete={() => undefined}
      />,
    );

    expect(html).toContain('Motion 卡片已就绪');
  });
});
