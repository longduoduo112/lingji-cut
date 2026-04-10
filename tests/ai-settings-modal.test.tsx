import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AISettingsModal } from '../src/components/AISettingsModal';

describe('AISettingsModal', () => {
  it('renders modal content during server-side rendering fallback', () => {
    const html = renderToStaticMarkup(
      <AISettingsModal
        visible
        settings={{
          llmBaseUrl: 'https://api.openai.com/v1',
          llmApiKey: 'sk-test',
          llmModel: 'gpt-4o',
          enableThinking: true,
          jimengApiUrl: 'http://47.109.159.194:8330',
          jimengSessionId: 'session-test',
          minimaxApiKey: 'mm-key',
          minimaxGroupId: 'mm-group',
          minimaxVoiceId: 'male-qn-qingse',
          minimaxSpeed: 1.0,
        }}
        onClose={() => undefined}
        onSave={() => undefined}
      />,
    );

    expect(html).toContain('AI 配置');
    expect(html).toContain('LLM API Base URL');
    expect(html).toContain('即梦 Session ID');
    expect(html).toContain('开启思考模式');
    expect(html).toContain('语音合成（MiniMax）');
    expect(html).toContain('MiniMax API Key');
    expect(html).toContain('MiniMax Group ID');
  });
});
