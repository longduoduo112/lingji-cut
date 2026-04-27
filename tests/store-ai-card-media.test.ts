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
});
