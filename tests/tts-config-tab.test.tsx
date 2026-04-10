import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TTSConfigTab } from '../src/components/settings/TTSConfigTab';

// TTSConfigTab 使用 loadAISettings/saveAISettings（异步），在 SSR 时初始值来自 useState 默认值
vi.mock('../src/store/ai', () => ({
  loadAISettings: () => Promise.resolve(null),
  saveAISettings: vi.fn(),
}));

describe('TTSConfigTab', () => {
  it('renders voice id as text input with MiniMax TTS configuration fields', () => {
    const html = renderToStaticMarkup(<TTSConfigTab />);

    expect(html).toContain('音色 ID');
    expect(html).toContain('placeholder="例如：male-qn-qingse"');
    // 音色 ID 字段使用 text input
    expect(html).toContain('type="text"');
    // 模型和情绪字段使用 select
    expect(html).toContain('speech-2.8-hd');
    expect(html).toContain('TTS 语音合成配置');
  });
});
