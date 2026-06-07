import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { useAIStore } from '../src/store/ai';
import type { AIAnalysisResult, MediaCardContent } from '../src/types/ai';

function makeAnalysis(): AIAnalysisResult {
  return {
    segments: [
      {
        id: 'seg-1',
        title: 't',
        summary: 's',
        startMs: 0,
        endMs: 1000,
      },
    ],
    cards: [],
    coverPrompts: [],
    summary: '',
    keywords: [],
  };
}

describe('AI store: media card actions', () => {
  beforeEach(() => {
    useAIStore.setState({
      analysisResult: makeAnalysis(),
      currentProjectDir: null,
      cardMediaTasks: {},
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('createImageCard 插入 idle 状态卡片', async () => {
    const card = await useAIStore.getState().createImageCard('seg-1', {
      prompt: 'a cat',
      aspectRatio: '16:9',
    });
    expect(card.type).toBe('image');
    const content = card.content as MediaCardContent;
    expect(content.generationStatus).toBe('idle');
    expect(content.prompt).toBe('a cat');
    expect(content.mediaType).toBe('image');
    expect(content.aspectRatio).toBe('16:9');
    // 入 store
    const found = useAIStore.getState().analysisResult!.cards.find((c) => c.id === card.id);
    expect(found).toBeTruthy();
  });

  it('createVideoCard displayDurationMs = durationSeconds*1000', async () => {
    const card = await useAIStore.getState().createVideoCard('seg-1', {
      durationSeconds: 8,
      aspectRatio: '16:9',
    });
    expect(card.type).toBe('video');
    expect(card.displayDurationMs).toBe(8000);
    const content = card.content as MediaCardContent;
    expect(content.mediaType).toBe('video');
    expect(content.aspectRatio).toBe('16:9');
    expect(content.generationStatus).toBe('idle');
  });

  it('regenerateCardMedia 成功后写回 ready 与新内容', async () => {
    const fakeMedia: MediaCardContent = {
      mediaType: 'image',
      assetPath: 'ai-cards/c/image.png',
      aspectRatio: '16:9',
      prompt: 'p',
      providerId: 'p1',
      model: 'm1',
      generationStatus: 'ready',
      generatedAt: 1,
    };
    vi.stubGlobal('window', {
      electronAPI: {
        generateCardImage: async () => fakeMedia,
        onCardMediaProgress: () => () => {},
      },
    });
    useAIStore.setState({ currentProjectDir: '/tmp/proj' });
    const card = await useAIStore.getState().createImageCard('seg-1');
    await useAIStore.getState().regenerateCardMedia(card.id);
    const updated = useAIStore.getState().analysisResult!.cards.find((c) => c.id === card.id)!;
    const content = updated.content as MediaCardContent;
    expect(content.generationStatus).toBe('ready');
    expect(content.assetPath).toBe('ai-cards/c/image.png');
  });

  it('convertCardToMotion: 有背景段 → 走 regenerateAICard 并保号', async () => {
    useAIStore.setState({
      analysisResult: {
        segments: [{ id: 'seg-1', title: 't', summary: 's', startMs: 0, endMs: 1000 }],
        cards: [
          {
            id: 'card-x',
            segmentId: 'seg-1',
            type: 'image',
            title: '原标题',
            content: {
              mediaType: 'image',
              assetPath: 'ai-cards/c/i.png',
              aspectRatio: '16:9',
              prompt: 'p',
              providerId: null,
              model: null,
              generationStatus: 'ready',
            },
            startMs: 0,
            endMs: 1000,
            displayDurationMs: 1000,
            displayMode: 'fullscreen',
            template: 'image',
            enabled: true,
            style: {} as never,
            renderMode: 'legacy',
          },
        ],
        coverPrompts: [],
        summary: '',
        keywords: [],
      },
      currentProjectDir: '/tmp/proj',
      projectBindings: null,
    });

    const calls: { regen: number; subs: number } = { regen: 0, subs: 0 };
    vi.stubGlobal('window', {
      electronAPI: {
        loadGlobalSettings: async () =>
          JSON.stringify({
            aiSettings: {
              llmProviders: [{ id: 'p1', name: 'p', type: 'openai', baseUrl: 'x', apiKey: 'k', models: ['m'] }],
              defaultProviderId: 'p1',
              defaultModel: 'm',
            },
          }),
        regenerateAICard: async (args: { card: { id: string } }) => {
          calls.regen += 1;
          return {
            ...args.card,
            id: args.card.id,
            type: 'motion',
            content: '逐字稿',
            renderMode: 'motion-card',
            motionCard: { tsx: 'export default () => null', compiledAt: 0, prompt: '', retryCount: 0 },
          };
        },
        generateCardFromSubtitles: async () => {
          calls.subs += 1;
          throw new Error('不该走到 subtitles 路径');
        },
        saveProjectSection: async () => undefined,
      },
    });

    const result = await useAIStore.getState().convertCardToMotion('card-x');
    expect(calls.regen).toBe(1);
    expect(calls.subs).toBe(0);
    expect(result?.type).toBe('motion');
    expect(result?.renderMode).toBe('motion-card');
    const stored = useAIStore.getState().analysisResult!.cards.find((c) => c.id === 'card-x')!;
    expect(stored.type).toBe('motion');
    expect(stored.title).toBe('原标题'); // 保号
    expect(stored.motionCard?.tsx).toContain('export default');
  });

  it('convertCardToMotion: 无背景段（手动卡）→ 走 generateCardFromSubtitles', async () => {
    useAIStore.setState({
      analysisResult: {
        segments: [],
        cards: [
          {
            id: 'manual-1',
            segmentId: 'manual:abc',
            type: 'image',
            title: '手动卡',
            content: {
              mediaType: 'image',
              assetPath: null,
              aspectRatio: '16:9',
              prompt: '海边日落',
              providerId: null,
              model: null,
              generationStatus: 'idle',
            },
            startMs: 0,
            endMs: 0,
            displayDurationMs: 5000,
            displayMode: 'fullscreen',
            template: 'image',
            enabled: true,
            style: {} as never,
            renderMode: 'legacy',
          },
        ],
        coverPrompts: [],
        summary: '',
        keywords: [],
      },
      currentProjectDir: '/tmp/proj',
      projectBindings: null,
    });

    let draftSeen: { text: string; type: string } | null = null;
    vi.stubGlobal('window', {
      electronAPI: {
        loadGlobalSettings: async () =>
          JSON.stringify({
            aiSettings: {
              llmProviders: [{ id: 'p1', name: 'p', type: 'openai', baseUrl: 'x', apiKey: 'k', models: ['m'] }],
              defaultProviderId: 'p1',
              defaultModel: 'm',
            },
          }),
        generateCardFromSubtitles: async (args: { draft: { text: string; type: string } }) => {
          draftSeen = args.draft;
          return {
            id: 'GEN',
            segmentId: 'manual-xyz',
            type: 'motion',
            title: '生成',
            content: '海边日落',
            startMs: 0,
            endMs: 5000,
            displayDurationMs: 5000,
            displayMode: 'fullscreen',
            template: 'motion',
            enabled: true,
            style: {},
            renderMode: 'motion-card',
            motionCard: { tsx: 'export default () => null', compiledAt: 0, prompt: '', retryCount: 0 },
          };
        },
        saveProjectSection: async () => undefined,
      },
    });

    const result = await useAIStore.getState().convertCardToMotion('manual-1');
    expect(draftSeen).not.toBeNull();
    expect(draftSeen!.text).toBe('海边日落');
    expect(draftSeen!.type).toBe('motion');
    expect(result?.id).toBe('manual-1'); // 保号
    expect(result?.title).toBe('手动卡');
  });

  it('convertCardToMotion: 已是 motion 家族 → 返回 null 不调用 IPC', async () => {
    useAIStore.setState({
      analysisResult: {
        segments: [],
        cards: [
          {
            id: 'm1',
            segmentId: 'seg',
            type: 'motion',
            title: 't',
            content: 'x',
            startMs: 0,
            endMs: 1000,
            displayDurationMs: 1000,
            displayMode: 'fullscreen',
            template: 'motion',
            enabled: true,
            style: {} as never,
            renderMode: 'motion-card',
          },
        ],
        coverPrompts: [],
        summary: '',
        keywords: [],
      },
    });
    const result = await useAIStore.getState().convertCardToMotion('m1');
    expect(result).toBeNull();
  });
});
