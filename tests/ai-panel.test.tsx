import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AIPanel } from '../src/components/AIPanel';

const mockModules = vi.hoisted(() => {
  const buildAnalysisResult = () => ({
    cards: [
      {
        id: 'card-1',
        type: 'summary' as const,
        title: '本期要点',
        content: '重点内容',
        startMs: 0,
        endMs: 45_000,
        displayDurationMs: 5_000,
        displayMode: 'fullscreen' as const,
        template: 'summary-default',
        enabled: true,
        style: {
          primaryColor: '#6366f1',
          backgroundColor: '#0f172a',
          fontSize: 48,
        },
      },
    ],
    coverPrompts: ['提示词'],
    summary: '总结',
    keywords: ['AI'],
    globalPrompt: '整体偏商业分析风',
  });

  const buildTimeline = () => ({
    podcast: {
      srtPath: '/tmp/test.srt',
    },
    tracks: [{ id: 'visual-1', kind: 'visual', label: '轨道 1', order: 1 }],
    overlays: [
      {
        id: 'overlay-1',
        type: 'image',
        assetPath: '',
        trackId: 'visual-1',
        startMs: 0,
        durationMs: 5_000,
        position: { x: 0, y: 0, width: 1920, height: 1080 },
        overlayType: 'ai-card' as const,
        aiCardData: {
          sourceCardId: 'card-1',
          cardType: 'summary' as const,
          title: '本期要点',
          content: '重点内容',
          template: 'summary-default',
          displayMode: 'fullscreen' as const,
          style: {
            primaryColor: '#6366f1',
            backgroundColor: '#0f172a',
            fontSize: 48,
          },
        },
      },
    ],
  });

  return {
    buildAnalysisResult,
    buildTimeline,
    aiStoreState: {
      analysisResult: buildAnalysisResult(),
      isAnalyzing: false,
      analysisError: null as string | null,
      coverCandidates: [],
      isGeneratingCovers: false,
      activeTab: 'cards' as const,
      setAnalysisResult: () => undefined,
      setAnalyzing: () => undefined,
      setAnalysisError: () => undefined,
      toggleCardEnabled: () => undefined,
      updateCard: () => undefined,
      setCoverCandidates: () => undefined,
      selectCover: () => undefined,
      setGeneratingCovers: () => undefined,
      setActiveTab: () => undefined,
      clearAnalysis: () => undefined,
    },
    timelineState: {
      srtEntries: [{ index: 1, startMs: 0, endMs: 2_000, text: 'hello' }],
      timeline: buildTimeline(),
      addAICardsToTimeline: () => undefined,
    },
  };
});

vi.mock('../src/store/ai', () => ({
  useAIStore: () => mockModules.aiStoreState,
  loadAISettings: () => ({
    llmBaseUrl: 'https://api.openai.com/v1',
    llmApiKey: 'sk-test',
    llmModel: 'gpt-4o',
    jimengApiUrl: 'http://47.109.159.194:8330',
    jimengSessionId: 'session-test',
  }),
  saveAISettings: () => undefined,
}));

vi.mock('../src/store/timeline', () => ({
  useTimelineStore: () => mockModules.timelineState,
  getProjectDir: () => '/tmp/project',
}));

describe('AIPanel', () => {
  beforeEach(() => {
    mockModules.aiStoreState.analysisResult = mockModules.buildAnalysisResult();
    mockModules.aiStoreState.isAnalyzing = false;
    mockModules.aiStoreState.analysisError = null;
    mockModules.aiStoreState.coverCandidates = [];
    mockModules.aiStoreState.isGeneratingCovers = false;
    mockModules.aiStoreState.activeTab = 'cards';
    mockModules.timelineState.srtEntries = [{ index: 1, startMs: 0, endMs: 2_000, text: 'hello' }];
    mockModules.timelineState.timeline = mockModules.buildTimeline();
  });

  it('renders the assistant header, tabs and apply action', () => {
    const html = renderToStaticMarkup(<AIPanel compact={false} />);

    expect(html).toContain('AI 助手');
    expect(html).toContain('内容卡片');
    expect(html).toContain('封面');
    expect(html).toContain('应用到时间线');
    expect(html).toContain('重新分析');
    expect(html).toContain('已在轨道 1');
    expect(html).toContain('整体创作提示词');
  });

  it('shows explicit loading feedback while analyzing content', () => {
    mockModules.aiStoreState.analysisResult = null;
    mockModules.aiStoreState.isAnalyzing = true;

    const html = renderToStaticMarkup(<AIPanel compact={false} />);

    expect(html).toContain('分析中...');
    expect(html).toContain('AI 正在工作');
    expect(html).toContain('正在拆解字幕与生成卡片');
    expect(html).toContain('解析字幕');
    expect(html).toContain('aria-busy="true"');
  });

  it('keeps the compact assistant footer action visible', () => {
    const html = renderToStaticMarkup(<AIPanel compact railHeight={154} />);

    expect(html).toContain('AI 助手');
    expect(html).toContain('应用到时间线');
    expect(html).toContain('卡片');
  });
});
