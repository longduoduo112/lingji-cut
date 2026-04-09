import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAISettings, saveAISettings } from '../src/store/ai';

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
    });
  });

  it('persists enableThinking when explicitly disabled', () => {
    saveAISettings({
      llmBaseUrl: 'https://api.openai.com/v1',
      llmApiKey: 'sk-test',
      llmModel: 'gpt-4o',
      jimengApiUrl: 'http://47.109.159.194:8330',
      jimengSessionId: 'session-test',
      enableThinking: false,
    });

    expect(loadAISettings()).toMatchObject({
      enableThinking: false,
    });
  });
});
