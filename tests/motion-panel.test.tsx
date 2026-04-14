import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MotionPanel } from '../src/components/MotionPanel';
import type { AICard, AIStoryboardPlan } from '../src/types/ai';

const mockModules = vi.hoisted(() => {
  const state: {
    motionCards: AICard[];
    addMotionCard: (card: AICard) => void;
    updateMotionCard: (cardId: string, updates: Partial<AICard>) => void;
    removeMotionCard: (cardId: string) => void;
    setMotionCards: (cards: AICard[]) => void;
    isGeneratingMotion: boolean;
    setGeneratingMotion: (value: boolean) => void;
    motionError: string | null;
    setMotionError: (value: string | null) => void;
    storyboardPlan: AIStoryboardPlan | null;
    isPlanningStoryboard: boolean;
    storyboardError: string | null;
    setPlanningStoryboard: (value: boolean) => void;
    setStoryboardError: (value: string | null) => void;
    setStoryboardPlan: (plan: AIStoryboardPlan | null) => void;
    analysisResult: null;
  } = {
    motionCards: [],
    addMotionCard: () => undefined,
    updateMotionCard: () => undefined,
    removeMotionCard: () => undefined,
    setMotionCards: () => undefined,
    isGeneratingMotion: false,
    setGeneratingMotion: () => undefined,
    motionError: null,
    setMotionError: () => undefined,
    storyboardPlan: null,
    isPlanningStoryboard: false,
    storyboardError: null,
    setPlanningStoryboard: () => undefined,
    setStoryboardError: () => undefined,
    setStoryboardPlan: () => undefined,
    analysisResult: null,
  };
  return {
    aiStoreState: state,
    timelineState: {
      addAICardsToTimeline: () => undefined,
      srtEntries: [] as Array<{ index: number; startMs: number; endMs: number; text: string }>,
    },
  };
});

vi.mock('../src/store/ai', () => ({
  useAIStore: () => mockModules.aiStoreState,
  loadAISettings: () => null,
}));

vi.mock('../src/store/timeline', () => ({
  useTimelineStore: () => mockModules.timelineState,
}));

describe('MotionPanel', () => {
  it('renders storyboard entry, empty state and folded 补充创建 by default', () => {
    mockModules.aiStoreState.motionCards = [];
    mockModules.aiStoreState.storyboardPlan = null;

    const html = renderToStaticMarkup(<MotionPanel />);

    // 整体创作提示词输入区和分析按钮
    expect(html).toContain('整体创作提示词');
    expect(html).toContain('分析并生成动画卡片');

    // 旧版"快速开始"已移除
    expect(html).not.toContain('快速开始');
    expect(html).not.toContain('飞入柱状图');
    expect(html).not.toContain('数字翻牌');
    expect(html).not.toContain('Logo 光晕');
    expect(html).not.toContain('波形呼吸');

    // 空态文案引导用户填写提示词后分析（HTML 会对双引号做实体转义）
    expect(html).toContain('还没有动画卡片');
    expect(html).toContain('分析并生成动画卡片&quot;');

    // 补充创建默认折叠：开关和提示可见，但内部的描述框不渲染
    expect(html).toContain('补充创建动画');
    expect(html).toContain('手动描述一张额外的动画卡片');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('生成一张补充动画');
  });

  it('surfaces motion cards that were auto-generated from the storyboard plan', () => {
    mockModules.aiStoreState.storyboardPlan = {
      segments: [],
      suggestions: [],
      summary: '',
      generatedAt: 0,
    };
    mockModules.aiStoreState.motionCards = [
      {
        id: 'storyboard-motion-visual-1',
        segmentId: 'segment-1',
        type: 'motion',
        title: '营收增长',
        content: '营收增长：同比上涨 12%',
        cardPrompt: '生成一个 16:9 全屏 Remotion 动画…',
        startMs: 0,
        endMs: 4_000,
        displayDurationMs: 4_000,
        displayMode: 'fullscreen',
        template: 'motion-kpi-countup',
        enabled: true,
        style: { primaryColor: '#c084fc', backgroundColor: '#05060c', fontSize: 46 },
        renderMode: 'motion-card',
        motionCard: {
          prompt: '生成一个 16:9 全屏 Remotion 动画…',
          sourceCode: 'export const Motion = () => null;',
          compiledCode: 'export const Motion = () => null;',
          compiledAt: Date.now(),
          retryCount: 0,
        },
      },
    ];

    const html = renderToStaticMarkup(<MotionPanel />);

    // 列表展示自动生成的动画卡片
    expect(html).toContain('营收增长');
    // 底部上轨按钮出现
    expect(html).toContain('上轨 1 张动画');
  });
});
