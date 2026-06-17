// @vitest-environment jsdom
//
// AgentSettingsTab 全局单选 agent + 模型下拉 的最小渲染测试（pi-only）：
// - 唯一 agent（pi）点「设为当前」→ setActiveAgent('pi') 且 saveConfig 入参 activeAgentId=pi。
// - Model 下拉选择 → 写回 config.agents[pi].model（saveConfig 入参断言）。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// 补 ui 库依赖链可能引用的 window.matchMedia（jsdom 默认不实现）。
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

const getConfig = vi.fn();
const saveConfig = vi.fn(async () => undefined);
const setActiveAgent = vi.fn(async () => undefined);
const getApiKey = vi.fn(async () => '');
const setApiKey = vi.fn(async () => undefined);
const runPreflight = vi.fn(async () => [{ label: 'CLI', status: 'pass', message: 'ok' }]);
const setPermissionPolicy = vi.fn();

function baseConfig() {
  // activeAgentId 故意留一个 stale 值（非 pi），确保渲染出「设为当前」按钮，
  // 以便断言激活态持久化（setActiveAgent + saveConfig）。
  return {
    permissionPolicy: 'tiered',
    activeAgentId: 'stale-agent',
    agents: {
      pi: {
        enabled: true,
        authMode: 'custom_api',
        apiKey: '',
        apiBaseUrl: '',
        model: '',
        envText: '',
        configJson: '{}',
        version: '',
        sortOrder: 0,
        skills: [{ id: 'lingji-video-workflow', enabled: true }],
      },
    },
  };
}

beforeEach(() => {
  getConfig.mockResolvedValue(baseConfig());
  saveConfig.mockClear();
  setActiveAgent.mockClear();
  (window as unknown as { agentAPI: unknown }).agentAPI = {
    getConfig,
    saveConfig,
    setActiveAgent,
    getApiKey,
    setApiKey,
    runPreflight,
    setPermissionPolicy,
  };
});

afterEach(() => {
  delete (window as unknown as { agentAPI?: unknown }).agentAPI;
});

async function mount() {
  const { AgentSettingsTab } = await import('../src/components/settings/AgentSettingsTab');
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<AgentSettingsTab />);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return { container, root };
}

function clickByText(container: HTMLElement, text: string) {
  const el = Array.from(container.querySelectorAll('button')).find((b) =>
    (b.textContent ?? '').includes(text),
  );
  if (!el) throw new Error(`button not found: ${text}`);
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('AgentSettingsTab 全局单选 + 模型下拉', () => {
  it('唯一 agent（pi）设为当前 → saveConfig 入参 activeAgentId=pi', async () => {
    const { container, root } = await mount();

    // pi-only：PillGroup 只有 Pi 一项
    const piPill = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').trim() === 'Pi',
    );
    expect(piPill).toBeDefined();

    // 「设为当前」→ 应立即落盘（不依赖随后的「保存配置」）
    await act(async () => {
      clickByText(container, '设为当前');
      await Promise.resolve();
    });
    expect(setActiveAgent).toHaveBeenCalledWith('pi');

    // 保存
    await act(async () => {
      clickByText(container, '保存配置');
      await Promise.resolve();
    });

    expect(saveConfig).toHaveBeenCalled();
    const arg = saveConfig.mock.calls.at(-1)![0] as { activeAgentId?: string };
    expect(arg.activeAgentId).toBe('pi');

    act(() => root.unmount());
    container.remove();
  });

  it('选择模型下拉 → 写回 config.agents[pi].model', async () => {
    const { container, root } = await mount();

    // 打开 Model 下拉（trigger button：pi 无 model，显示 defaultModel 标签）
    const listbox = () => document.querySelector('[role="listbox"]');
    // 找到 Model Select 的触发按钮：含 ChevronDown 的 listbox trigger，文本含模型名
    const trigger = Array.from(container.querySelectorAll('button[aria-haspopup="listbox"]'))[0] as
      | HTMLButtonElement
      | undefined;
    expect(trigger).toBeDefined();
    await act(async () => {
      trigger!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const option = Array.from(listbox()!.querySelectorAll('[role="option"]')).find((o) =>
      (o.textContent ?? '').includes('Opus'),
    ) as HTMLElement;
    expect(option).toBeDefined();
    await act(async () => {
      option.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    await act(async () => {
      clickByText(container, '保存配置');
      await Promise.resolve();
    });

    const arg = saveConfig.mock.calls.at(-1)![0] as {
      agents: Record<string, { model: string }>;
    };
    expect(arg.agents.pi.model).toBe('anthropic/claude-opus-4-5');

    act(() => root.unmount());
    container.remove();
  });
});
