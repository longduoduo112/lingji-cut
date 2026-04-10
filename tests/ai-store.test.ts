import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAISettings, saveAISettings, useAIStore } from '../src/store/ai';

const AI_SETTINGS_KEY = 'podcast-editor-ai-settings';

function createStorageMock() {
  const storage = new Map<string, string>();

  return {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
  };
}

describe('AI settings store helpers', () => {
  beforeEach(() => {
    const localStorage = createStorageMock();
    vi.stubGlobal('window', { localStorage });
    localStorage.clear();
    useAIStore.getState().resetWorkflow();
  });

  it('defaults enableThinking to true when loading legacy settings', () => {
    window.localStorage.setItem(
      AI_SETTINGS_KEY,
      JSON.stringify({
        llmBaseUrl: 'https://api.openai.com/v1',
        llmApiKey: 'sk-test',
        llmModel: 'gpt-4o',
        jimengApiUrl: 'http://47.109.159.194:8330',
        jimengSessionId: 'session-test',
      }),
    );

    expect(loadAISettings()).toMatchObject({
      enableThinking: true,
      minimaxApiKey: '',
      minimaxGroupId: '',
      minimaxVoiceId: 'male-qn-qingse',
      minimaxSpeed: 1.0,
    });
  });

  it('persists enableThinking and minimax settings when explicitly configured', () => {
    saveAISettings({
      llmBaseUrl: 'https://api.openai.com/v1',
      llmApiKey: 'sk-test',
      llmModel: 'gpt-4o',
      jimengApiUrl: 'http://47.109.159.194:8330',
      jimengSessionId: 'session-test',
      enableThinking: false,
      minimaxApiKey: 'mm-key',
      minimaxGroupId: 'mm-group',
      minimaxVoiceId: 'female-yujie',
      minimaxSpeed: 1.25,
    });

    expect(loadAISettings()).toMatchObject({
      enableThinking: false,
      minimaxApiKey: 'mm-key',
      minimaxGroupId: 'mm-group',
      minimaxVoiceId: 'female-yujie',
      minimaxSpeed: 1.25,
    });
  });

  it('supports workflow updates and reset', () => {
    useAIStore.getState().setWorkflow({
      step: 'tts_generating',
      progress: 42,
      stepLabel: '正在生成语音…',
      canCancel: true,
    });

    expect(useAIStore.getState().workflow).toMatchObject({
      step: 'tts_generating',
      progress: 42,
      stepLabel: '正在生成语音…',
      canCancel: true,
      error: null,
    });

    useAIStore.getState().resetWorkflow();

    expect(useAIStore.getState().workflow).toEqual({
      step: 'idle',
      progress: 0,
      stepLabel: '',
      error: null,
      canCancel: false,
    });
  });
});
