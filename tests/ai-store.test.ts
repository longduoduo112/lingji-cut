import { beforeEach, describe, expect, it } from 'vitest';
import { useAIStore } from '../src/store/ai';
import type { AICard, AIAnalysisResult } from '../src/types/ai';

const makeCard = (id: string, type: AICard['type'], startMs: number): AICard => ({
  id,
  type,
  title: `Card ${id}`,
  content: 'test content',
  startMs,
  endMs: startMs + 30_000,
  displayDurationMs: 5_000,
  displayMode: 'fullscreen',
  template: `${type}-default`,
  enabled: true,
  style: { primaryColor: '#6366f1', backgroundColor: '#0f172a', fontSize: 48 },
});

describe('AI store', () => {
  beforeEach(() => {
    useAIStore.setState({
      analysisResult: null,
      isAnalyzing: false,
      analysisError: null,
      coverCandidates: [],
      isGeneratingCovers: false,
      activeTab: 'cards',
    });
  });

  it('starts with an empty analysis result', () => {
    expect(useAIStore.getState().analysisResult).toBeNull();
  });

  it('stores the latest analysis result', () => {
    const result: AIAnalysisResult = {
      cards: [makeCard('1', 'summary', 0)],
      coverPrompts: ['prompt-1'],
      summary: 'summary',
      keywords: ['AI'],
      globalPrompt: '整体偏商业分析风',
    };

    useAIStore.getState().setAnalysisResult(result);

    expect(useAIStore.getState().analysisResult?.cards).toHaveLength(1);
  });

  it('toggles a card enabled flag', () => {
    useAIStore.getState().setAnalysisResult({
      cards: [makeCard('1', 'summary', 0)],
      coverPrompts: [],
      summary: '',
      keywords: [],
    });

    useAIStore.getState().toggleCardEnabled('1');

    expect(useAIStore.getState().analysisResult?.cards[0]?.enabled).toBe(false);
  });

  it('updates a card in place', () => {
    useAIStore.getState().setAnalysisResult({
      cards: [makeCard('1', 'summary', 0)],
      coverPrompts: [],
      summary: '',
      keywords: [],
    });

    useAIStore.getState().updateCard('1', { title: 'New Title' });

    expect(useAIStore.getState().analysisResult?.cards[0]?.title).toBe('New Title');
  });

  it('keeps prompt fields on analysis result and cards', () => {
    useAIStore.getState().setAnalysisResult({
      cards: [makeCard('1', 'summary', 0)],
      coverPrompts: [],
      summary: '',
      keywords: [],
      globalPrompt: '整体偏商业分析风',
    });

    useAIStore.getState().updateCard('1', { cardPrompt: '改成更像封面大字报' });

    expect(useAIStore.getState().analysisResult?.globalPrompt).toBe('整体偏商业分析风');
    expect(useAIStore.getState().analysisResult?.cards[0]?.cardPrompt).toBe('改成更像封面大字报');
  });
});
