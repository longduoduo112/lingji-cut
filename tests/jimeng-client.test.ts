import { describe, expect, it } from 'vitest';
import {
  buildJimengImageRequest,
  extractJimengImageUrl,
} from '../src/lib/jimeng-client';
import type { AISettings } from '../src/types/ai';

const settings: AISettings = {
  llmBaseUrl: '',
  llmApiKey: '',
  llmModel: '',
  jimengApiUrl: 'http://47.109.159.194:8330/',
  jimengSessionId: 'session-test',
};

describe('buildJimengImageRequest', () => {
  it('builds a Jimeng generation request with the expected defaults', () => {
    const request = buildJimengImageRequest('一张科技感播客封面', settings);

    expect(request.url).toBe('http://47.109.159.194:8330/v1/images/generations');
    expect(request.headers.Authorization).toBe('Bearer session-test');
    expect(request.body.model).toBe('jimeng-4.5');
    expect(request.body.ratio).toBe('16:9');
  });
});

describe('extractJimengImageUrl', () => {
  it('returns the first image url from the api response', () => {
    expect(
      extractJimengImageUrl({
        data: [{ url: 'https://example.com/cover.png' }],
      }),
    ).toBe('https://example.com/cover.png');
  });

  it('returns null for malformed api payloads', () => {
    expect(extractJimengImageUrl({ data: [] })).toBeNull();
  });
});
