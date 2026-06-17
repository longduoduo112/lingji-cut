// @vitest-environment jsdom
//
// ThinkingLevelPicker 测试：
// - pi（有 reasoningOptions）→ 渲染芯片，展开列出档位，选择回调。
// - 无 reasoningOptions 的 agent → 不渲染（返回 null）。
//   注：当前 runtime 仅内置 pi（带 reasoningOptions），故用 mock 注入一个空 options
//   的合成 agent 来覆盖「无档位 → null」这条防御性分支。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ThinkingLevelPicker } from '../src/components/agent/ThinkingLevelPicker';

vi.mock('../src/lib/agent-presentation', async (importActual) => {
  const actual = await importActual<typeof import('../src/lib/agent-presentation')>();
  return {
    ...actual,
    getAgentPresentation: (id: string | undefined | null) =>
      id === '__no-reasoning__'
        ? { id: '__no-reasoning__', displayName: 'NoReasoning', managed: false, reasoningOptions: [] }
        : actual.getAgentPresentation(id),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function mount(node: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
  });
  return { container, root };
}

describe('ThinkingLevelPicker', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('pi：渲染芯片并能展开选择档位', async () => {
    const onChange = vi.fn();
    const { container, root } = await mount(
      <ThinkingLevelPicker agentId="pi" onChange={onChange} />,
    );

    const chip = container.querySelector('[data-testid="thinking-level-chip"]');
    expect(chip).not.toBeNull();

    act(() => {
      chip!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const high = container.querySelector('[data-reasoning-id="high"]');
    expect(high).not.toBeNull();
    act(() => {
      high!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith('high');

    act(() => root.unmount());
  });

  it('无 reasoningOptions 的 agent → 不渲染', async () => {
    const { container, root } = await mount(
      <ThinkingLevelPicker agentId="__no-reasoning__" onChange={() => undefined} />,
    );
    expect(container.querySelector('[data-testid="thinking-level-chip"]')).toBeNull();
    act(() => root.unmount());
  });
});
