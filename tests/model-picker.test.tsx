// @vitest-environment jsdom
//
// ModelPicker 测试：
// - 渲染当前 agent 名 + 当前模型 label。
// - 点击模型区展开下拉，列出该 agent 的 models。
// - 选择模型 → onChange(modelId)。
// - 点击 agent 区 → onOpenAgentSettings。
// agent / models 来自真实 registry（claude 有 Sonnet/Opus/Haiku）。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ModelPicker } from '../src/components/agent/ModelPicker';
import { getAgentPresentation } from '../src/lib/agent-presentation';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface MountProps {
  agentId?: string;
  value?: string;
  onChange?: (id: string) => void;
  onOpenAgentSettings?: () => void;
}

async function mount(props: MountProps) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <ModelPicker
        agentId={props.agentId ?? 'claude'}
        value={props.value}
        onChange={props.onChange ?? (() => undefined)}
        onOpenAgentSettings={props.onOpenAgentSettings}
      />,
    );
  });
  return { container, root };
}

function cleanup(root: { unmount(): void }, container: HTMLElement) {
  act(() => root.unmount());
  container.remove();
}

describe('ModelPicker', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders current agent name and default model label', async () => {
    const presentation = getAgentPresentation('claude');
    const { container, root } = await mount({ agentId: 'claude' });

    expect(container.textContent).toContain(presentation.displayName);
    // 缺省 value → 用 defaultModel 的 label。
    const defaultModel = presentation.models?.find((m) => m.id === presentation.defaultModel);
    expect(container.textContent).toContain(defaultModel!.label);

    cleanup(root, container);
  });

  it('renders the controlled model label when value is provided', async () => {
    const presentation = getAgentPresentation('claude');
    const opus = presentation.models!.find((m) => m.id !== presentation.defaultModel)!;
    const { container, root } = await mount({ agentId: 'claude', value: opus.id });

    expect(container.querySelector('[data-testid="model-picker-model"]')!.textContent).toContain(
      opus.label,
    );

    cleanup(root, container);
  });

  it('opens dropdown listing models on model-area click', async () => {
    const presentation = getAgentPresentation('claude');
    const { container, root } = await mount({ agentId: 'claude' });

    expect(container.querySelector('[role="listbox"]')).toBeNull();

    const modelBtn = container.querySelector('[data-testid="model-picker-model"]')!;
    act(() => {
      modelBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const listbox = container.querySelector('[role="listbox"]');
    expect(listbox).not.toBeNull();
    // 列出全部模型选项。
    for (const model of presentation.models!) {
      expect(container.querySelector(`[data-model-id="${model.id}"]`)).not.toBeNull();
    }

    cleanup(root, container);
  });

  it('calls onChange(modelId) when a model option is selected', async () => {
    const presentation = getAgentPresentation('claude');
    const target = presentation.models!.find((m) => m.id !== presentation.defaultModel)!;
    const onChange = vi.fn();
    const { container, root } = await mount({ agentId: 'claude', onChange });

    act(() => {
      container
        .querySelector('[data-testid="model-picker-model"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    act(() => {
      container
        .querySelector(`[data-model-id="${target.id}"]`)!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith(target.id);
    // 选择后下拉收起。
    expect(container.querySelector('[role="listbox"]')).toBeNull();

    cleanup(root, container);
  });

  it('calls onOpenAgentSettings when the agent area is clicked', async () => {
    const onOpenAgentSettings = vi.fn();
    const { container, root } = await mount({ agentId: 'claude', onOpenAgentSettings });

    act(() => {
      container
        .querySelector('[data-testid="model-picker-agent"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onOpenAgentSettings).toHaveBeenCalledTimes(1);
    // agent 区点击不应展开模型下拉。
    expect(container.querySelector('[role="listbox"]')).toBeNull();

    cleanup(root, container);
  });
});
