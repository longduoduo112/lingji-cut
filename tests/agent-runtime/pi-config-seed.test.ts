import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { writePiConfig } from '../../electron/agent-runtime/pi-config-seed';
import type { AISettings } from '../../src/types/ai';

describe('writePiConfig', () => {
  let dir: string;
  beforeEach(() => {
    dir = path.join(os.tmpdir(), `pi-cfg-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('writes models.json and settings.json from AISettings', async () => {
    const ai = {
      llmProviders: [{ id: 'a', name: 'A', type: 'openai_compatible', baseUrl: 'https://a/v1', apiKey: 'k', models: ['m1'] }],
      defaultProviderId: 'a', defaultModel: 'm1',
    } as unknown as AISettings;
    await writePiConfig(dir, ai);
    const models = JSON.parse(await fs.readFile(path.join(dir, 'models.json'), 'utf-8'));
    const settings = JSON.parse(await fs.readFile(path.join(dir, 'settings.json'), 'utf-8'));
    expect(models.providers.a.api).toBe('openai-completions');
    expect(settings.defaultProvider).toBe('a');
    expect(settings.defaultThinkingLevel).toBe('medium');
  });

  it('creates the directory if missing and handles empty providers', async () => {
    const ai = { llmProviders: [], defaultProviderId: null, defaultModel: null } as unknown as AISettings;
    await writePiConfig(dir, ai);
    const models = JSON.parse(await fs.readFile(path.join(dir, 'models.json'), 'utf-8'));
    expect(models).toEqual({ providers: {} });
  });
});
