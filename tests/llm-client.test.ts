import { describe, expect, it } from 'vitest';
import { buildChatRequest, parseLLMJsonResponse } from '../src/lib/llm-client';
import type { AISettings } from '../src/types/ai';

const settings: AISettings = {
  llmBaseUrl: 'https://api.openai.com/v1',
  llmApiKey: 'sk-test',
  llmModel: 'gpt-4o',
  jimengApiUrl: '',
  jimengSessionId: '',
};

describe('buildChatRequest', () => {
  it('builds an OpenAI-compatible request payload', () => {
    const request = buildChatRequest(settings, 'system prompt', 'user message');

    expect(request.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(request.body.model).toBe('gpt-4o');
    expect(request.body.messages).toHaveLength(2);
    expect(request.body.messages[0]).toEqual({ role: 'system', content: 'system prompt' });
    expect(request.body.messages[1]).toEqual({ role: 'user', content: 'user message' });
    expect(request.body.response_format).toEqual({ type: 'json_object' });
    expect(request.headers.Authorization).toBe('Bearer sk-test');
  });

  it('trims trailing slashes from the configured base url', () => {
    const request = buildChatRequest(
      { ...settings, llmBaseUrl: 'https://api.example.com/v1/' },
      'sys',
      'usr',
    );

    expect(request.url).toBe('https://api.example.com/v1/chat/completions');
  });
});

describe('parseLLMJsonResponse', () => {
  it('parses direct JSON content', () => {
    const result = parseLLMJsonResponse(
      '{"cards":[],"coverPrompts":[],"summary":"test","keywords":[]}',
    );

    expect(result).toEqual({
      cards: [],
      coverPrompts: [],
      summary: 'test',
      keywords: [],
    });
  });

  it('extracts JSON from markdown code blocks', () => {
    const result = parseLLMJsonResponse('```json\n{"cards":[]}\n```');

    expect(result).toEqual({ cards: [] });
  });

  it('returns null for invalid JSON', () => {
    expect(parseLLMJsonResponse('not json at all')).toBeNull();
  });
});
