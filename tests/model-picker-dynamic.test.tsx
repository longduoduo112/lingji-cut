// @vitest-environment jsdom
//
// ModelPicker 动态模型加载测试：
// - 切到 pi 时通过 window.agentAPI.listModels 拉取真实模型并渲染。
// - listModels 不存在（无桥接）时回退静态兜底，不崩。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ModelPicker } from '../src/components/agent/ModelPicker';
import { __clearAgentModelsCache } from '../src/lib/use-agent-models';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function mount(agentId: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<ModelPicker agentId={agentId} onChange={() => undefined} />);
  });
  await flush();
  return { container, root };
}

describe('ModelPicker dynamic models', () => {
  beforeEach(() => {
    __clearAgentModelsCache();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete (window as { agentAPI?: unknown }).agentAPI;
  });

  it('从 listModels 拉取的 live 模型出现在下拉中', async () => {
    (window as { agentAPI?: unknown }).agentAPI = {
      listModels: vi.fn().mockResolvedValue({
        models: [
          { id: 'default', label: 'Default' },
          { id: 'anthropic/claude-sonnet-4-5', label: 'anthropic/claude-sonnet-4-5' },
          { id: 'openai/gpt-5', label: 'openai/gpt-5' },
        ],
        source: 'live',
      }),
    };

    const { container, root } = await mount('pi');

    act(() => {
      container
        .querySelector('[data-testid="model-picker-model"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('[data-model-id="openai/gpt-5"]')).not.toBeNull();
    expect(container.querySelector('[data-model-id="anthropic/claude-sonnet-4-5"]')).not.toBeNull();
    expect((window.agentAPI as { listModels: ReturnType<typeof vi.fn> }).listModels).toHaveBeenCalledWith('pi');

    act(() => root.unmount());
  });

  it('无 listModels 桥接时回退静态兜底（不崩，仍有模型）', async () => {
    // 不设置 window.agentAPI
    const { container, root } = await mount('pi');

    act(() => {
      container
        .querySelector('[data-testid="model-picker-model"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // pi 静态兜底至少含 default + 一个具体模型
    expect(container.querySelector('[data-model-id="default"]')).not.toBeNull();
    expect(container.querySelectorAll('[role="option"]').length).toBeGreaterThan(1);

    act(() => root.unmount());
  });
});
