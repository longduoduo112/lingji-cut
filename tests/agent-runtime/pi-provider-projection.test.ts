import { describe, it, expect } from 'vitest';
import { llmTypeToPiApi, projectProviderToPi, buildPiModelsJson, buildPiSettingsJson } from '../../electron/agent-runtime/pi-provider-projection';
import type { LLMProvider, AISettings } from '../../src/types/ai';

describe('llmTypeToPiApi', () => {
  it('maps known LLM types to pi api strings', () => {
    expect(llmTypeToPiApi('openai_compatible')).toBe('openai-completions');
    expect(llmTypeToPiApi('lmstudio')).toBe('openai-completions');
    expect(llmTypeToPiApi('minimax')).toBe('openai-completions');
    expect(llmTypeToPiApi('anthropic')).toBe('anthropic-messages');
    expect(llmTypeToPiApi('gemini')).toBe('google-generative-ai');
  });
  it('returns null for claude_code_acp (not projected to pi)', () => {
    expect(llmTypeToPiApi('claude_code_acp')).toBeNull();
  });
});

describe('projectProviderToPi', () => {
  const base: LLMProvider = {
    id: 'p1', name: 'My OpenAI', type: 'openai_compatible',
    baseUrl: 'https://api.example.com/v1', apiKey: 'sk-xxx', models: ['gpt-x', 'gpt-y'],
  };
  it('projects an openai_compatible provider with full per-model schema', () => {
    const out = projectProviderToPi(base);
    expect(out).not.toBeNull();
    expect(out!.entry).toEqual({
      name: 'My OpenAI',
      baseUrl: 'https://api.example.com/v1',
      api: 'openai-completions',
      apiKey: 'sk-xxx',
      models: [
        { id: 'gpt-x', name: 'gpt-x', reasoning: false, input: ['text'], contextWindow: 128000, maxTokens: 8192,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          compat: { supportsDeveloperRole: false, supportsStore: false, supportsReasoningEffort: false, maxTokensField: 'max_tokens' } },
        { id: 'gpt-y', name: 'gpt-y', reasoning: false, input: ['text'], contextWindow: 128000, maxTokens: 8192,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          compat: { supportsDeveloperRole: false, supportsStore: false, supportsReasoningEffort: false, maxTokensField: 'max_tokens' } },
      ],
    });
  });
  it('uses provider.id as the pi provider key', () => {
    expect(projectProviderToPi(base)!.key).toBe('p1');
  });
  it('marks reasoning:true and supportsReasoningEffort:true when enableThinking is set', () => {
    const out = projectProviderToPi({ ...base, enableThinking: true });
    expect(out!.entry.models[0].reasoning).toBe(true);
    expect(out!.entry.models[0].compat.supportsReasoningEffort).toBe(true);
  });
  it('skips claude_code_acp providers', () => {
    expect(projectProviderToPi({ ...base, type: 'claude_code_acp' })).toBeNull();
  });
  it('skips providers with empty baseUrl or no models', () => {
    expect(projectProviderToPi({ ...base, baseUrl: '' })).toBeNull();
    expect(projectProviderToPi({ ...base, models: [] })).toBeNull();
  });
  it('skips providers with whitespace-only baseUrl', () => {
    expect(projectProviderToPi({ ...base, baseUrl: '   ' })).toBeNull();
  });
});

describe('buildPiModelsJson', () => {
  it('builds { providers } keyed by provider id, skipping unprojectable', () => {
    const ai = {
      llmProviders: [
        { id: 'a', name: 'A', type: 'openai_compatible', baseUrl: 'https://a/v1', apiKey: 'k', models: ['m1'] },
        { id: 'b', name: 'B', type: 'claude_code_acp', baseUrl: 'https://b', apiKey: '', models: [] },
      ],
      defaultProviderId: 'a', defaultModel: 'm1',
    } as unknown as AISettings;
    const out = buildPiModelsJson(ai);
    expect(Object.keys(out.providers)).toEqual(['a']);
    expect(out.providers.a.api).toBe('openai-completions');
  });
  it('returns empty providers when none projectable', () => {
    const ai = { llmProviders: [], defaultProviderId: null, defaultModel: null } as unknown as AISettings;
    expect(buildPiModelsJson(ai)).toEqual({ providers: {} });
  });
});

describe('buildPiSettingsJson', () => {
  it('derives defaultProvider/defaultModel from AISettings', () => {
    const ai = {
      llmProviders: [{ id: 'a', name: 'A', type: 'openai_compatible', baseUrl: 'https://a/v1', apiKey: 'k', models: ['m1'] }],
      defaultProviderId: 'a', defaultModel: 'm1',
    } as unknown as AISettings;
    expect(buildPiSettingsJson(ai)).toMatchObject({ defaultProvider: 'a', defaultModel: 'm1', defaultThinkingLevel: 'medium' });
  });
  it('omits defaultProvider when none resolves or it is unprojectable', () => {
    const none = { llmProviders: [], defaultProviderId: null, defaultModel: null } as unknown as AISettings;
    expect(buildPiSettingsJson(none).defaultProvider).toBeUndefined();
    const acpOnly = {
      llmProviders: [{ id: 'x', name: 'X', type: 'claude_code_acp', baseUrl: 'https://x', apiKey: '', models: [] }],
      defaultProviderId: 'x', defaultModel: null,
    } as unknown as AISettings;
    expect(buildPiSettingsJson(acpOnly).defaultProvider).toBeUndefined();
  });
});
