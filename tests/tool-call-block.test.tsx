// @vitest-environment jsdom
//
// ToolCallBlock（op-card 风格）测试：
//  - 状态徽章三态：running/pending → spinner；completed → 绿 check；failed/error → 红 X。
//  - 标题渲染工具名。
//  - 含 rawInput/rawOutput 时折叠区存在，点击卡头可展开。
// 结构断言用 SSR（renderToStaticMarkup），交互用 jsdom + createRoot + act。
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { ToolCallBlock } from '../src/components/agent/ToolCallBlock';

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

interface Block {
  type: 'tool_call';
  toolCallId: string;
  title: string;
  kind: string;
  status: string;
  rawInput?: string;
  rawOutput?: string;
}

function makeBlock(overrides: Partial<Block> = {}): Block {
  return {
    type: 'tool_call',
    toolCallId: 'tc-1',
    title: 'read_text_file',
    kind: 'read',
    status: 'completed',
    ...overrides,
  };
}

describe('ToolCallBlock 状态徽章', () => {
  it('running 状态渲染运行中徽章（spinner）', () => {
    const html = renderToStaticMarkup(
      <ToolCallBlock block={makeBlock({ status: 'in_progress' })} />,
    );
    expect(html).toContain('aria-label="运行中"');
    // Spinner 使用 SVG（animateTransform 旋转）。
    expect(html).toContain('animateTransform');
  });

  it('pending 状态也按运行中处理', () => {
    const html = renderToStaticMarkup(
      <ToolCallBlock block={makeBlock({ status: 'pending' })} />,
    );
    expect(html).toContain('aria-label="运行中"');
  });

  it('completed 状态渲染已完成（绿 check）徽章', () => {
    const html = renderToStaticMarkup(
      <ToolCallBlock block={makeBlock({ status: 'completed' })} />,
    );
    expect(html).toContain('aria-label="已完成"');
    // 绿色语义色。
    expect(html).toContain('#30D158');
  });

  it('failed/error 状态渲染失败（红 X）徽章', () => {
    const failed = renderToStaticMarkup(
      <ToolCallBlock block={makeBlock({ status: 'failed' })} />,
    );
    expect(failed).toContain('aria-label="失败"');
    expect(failed).toContain('#FF453A');

    const error = renderToStaticMarkup(
      <ToolCallBlock block={makeBlock({ status: 'error' })} />,
    );
    expect(error).toContain('aria-label="失败"');
  });
});

describe('ToolCallBlock 标题与元信息', () => {
  it('渲染工具名（title）', () => {
    const html = renderToStaticMarkup(<ToolCallBlock block={makeBlock()} />);
    expect(html).toContain('read_text_file');
  });

  it('渲染 kind 作为 meta', () => {
    const html = renderToStaticMarkup(
      <ToolCallBlock block={makeBlock({ kind: 'write' })} />,
    );
    expect(html).toContain('write');
  });
});

describe('ToolCallBlock 折叠展开', () => {
  it('failed 默认展开，rawInput/rawOutput 可见', () => {
    const html = renderToStaticMarkup(
      <ToolCallBlock
        block={makeBlock({
          status: 'failed',
          rawInput: '{"path":"a.md"}',
          rawOutput: 'permission denied',
        })}
      />,
    );
    expect(html).toContain('Input');
    expect(html).toContain('{&quot;path&quot;:&quot;a.md&quot;}');
    expect(html).toContain('Output');
    expect(html).toContain('permission denied');
  });

  it('completed 默认折叠，点击卡头展开后可见 rawInput', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <ToolCallBlock
          block={makeBlock({
            status: 'completed',
            rawInput: '{"path":"b.md"}',
          })}
        />,
      );
    });

    // 默认折叠：input 内容不可见。
    expect(container.textContent).not.toContain('b.md');

    const head = container.querySelector('button')!;
    expect(head).toBeTruthy();
    act(() => {
      head.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // 展开后 input 可见。
    expect(container.textContent).toContain('b.md');

    act(() => root.unmount());
    container.remove();
  });

  it('无 input/output 时卡头禁用且无折叠区', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<ToolCallBlock block={makeBlock({ status: 'completed' })} />);
    });
    const head = container.querySelector('button') as HTMLButtonElement;
    expect(head.disabled).toBe(true);
    act(() => root.unmount());
    container.remove();
  });
});
