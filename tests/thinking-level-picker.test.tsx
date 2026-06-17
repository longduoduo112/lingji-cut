// @vitest-environment jsdom
//
// ThinkingLevelPicker 测试：
// - pi（有 reasoningOptions）→ 渲染芯片，展开列出档位，选择回调。
// - claude（无 reasoningOptions）→ 不渲染（返回 null）。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ThinkingLevelPicker } from '../src/components/agent/ThinkingLevelPicker';

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

  it('claude：无 reasoningOptions → 不渲染', async () => {
    const { container, root } = await mount(
      <ThinkingLevelPicker agentId="claude" onChange={() => undefined} />,
    );
    expect(container.querySelector('[data-testid="thinking-level-chip"]')).toBeNull();
    act(() => root.unmount());
  });
});
