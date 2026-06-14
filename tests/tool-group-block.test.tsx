// @vitest-environment jsdom
//
// ToolGroupBlock + AssistantMessage 同名工具调用聚合测试。
// 结构断言用 SSR（renderToStaticMarkup），交互用 jsdom + createRoot + act。
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { AssistantMessage } from '../src/components/agent/AssistantMessage';
import { aggregateStatus } from '../src/components/agent/ToolGroupBlock';
import type { ConversationBlock, ConversationTurn } from '../src/types/conversation';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// 补 ui 库引用的 window.matchMedia（jsdom 默认不实现）。
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

function toolCall(
  title: string,
  status: string,
  id: string,
  rawInput?: string,
): ConversationBlock {
  return { type: 'tool_call', toolCallId: id, title, kind: 'edit', status, rawInput };
}

function makeTurn(blocks: ConversationBlock[]): ConversationTurn {
  return {
    id: 1,
    conversationId: 1,
    role: 'assistant',
    createdAt: '2026-01-01T00:00:00.000Z',
    agentId: 'claude',
    blocks,
  };
}

describe('ToolGroupBlock aggregateStatus', () => {
  it('全 completed → ok', () => {
    expect(
      aggregateStatus([
        { type: 'tool_call', toolCallId: 'a', title: 'Edit', kind: '', status: 'completed' },
        { type: 'tool_call', toolCallId: 'b', title: 'Edit', kind: '', status: 'completed' },
      ]),
    ).toBe('ok');
  });

  it('任一 failed → error', () => {
    expect(
      aggregateStatus([
        { type: 'tool_call', toolCallId: 'a', title: 'Edit', kind: '', status: 'completed' },
        { type: 'tool_call', toolCallId: 'b', title: 'Edit', kind: '', status: 'failed' },
      ]),
    ).toBe('error');
  });

  it('任一 running/pending → running（优先于 error）', () => {
    expect(
      aggregateStatus([
        { type: 'tool_call', toolCallId: 'a', title: 'Edit', kind: '', status: 'failed' },
        { type: 'tool_call', toolCallId: 'b', title: 'Edit', kind: '', status: 'in_progress' },
      ]),
    ).toBe('running');
  });
});

describe('AssistantMessage 同名工具调用聚合', () => {
  it('3 个连续同名 tool_call → 聚合卡 ×3，展开后含 3 个工具', () => {
    const turn = makeTurn([
      toolCall('Edit', 'completed', 'e1', '{"path":"a.ts"}'),
      toolCall('Edit', 'completed', 'e2', '{"path":"b.ts"}'),
      toolCall('Edit', 'completed', 'e3', '{"path":"c.ts"}'),
    ]);
    const html = renderToStaticMarkup(<AssistantMessage turn={turn} />);
    expect(html).toContain('Edit ×3');
    expect(html).toContain('Done');
  });

  it('展开聚合卡后列出各个工具卡（input 细节）', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const turn = makeTurn([
      toolCall('Edit', 'completed', 'e1', '{"path":"a.ts"}'),
      toolCall('Edit', 'completed', 'e2', '{"path":"b.ts"}'),
      toolCall('Edit', 'completed', 'e3', '{"path":"c.ts"}'),
    ]);
    act(() => {
      root.render(<AssistantMessage turn={turn} />);
    });

    // 聚合卡头按钮（aria-expanded）。
    const groupHeader = Array.from(container.querySelectorAll('button')).find((el) =>
      el.textContent?.includes('Edit ×3'),
    )!;
    expect(groupHeader).toBeTruthy();
    act(() => {
      groupHeader.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // 展开后内部应含 3 个单工具卡：组头 1 个 + 3 个单卡头 = 4 个按钮。
    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.length).toBe(4);
    // 3 个单卡标题（组头是 "Edit ×3"，单卡是纯 "Edit"）。
    const singleCardHeaders = buttons.filter(
      (el) => el.textContent?.includes('Edit') && !el.textContent.includes('×'),
    );
    expect(singleCardHeaders.length).toBe(3);

    act(() => root.unmount());
    container.remove();
  });

  it('不同名 tool_call 不聚合（各自单卡，无聚合 summary）', () => {
    const turn = makeTurn([
      toolCall('Edit', 'completed', 'e1'),
      toolCall('Read', 'completed', 'r1'),
    ]);
    const html = renderToStaticMarkup(<AssistantMessage turn={turn} />);
    expect(html).toContain('Edit');
    expect(html).toContain('Read');
    expect(html).not.toContain('×2');
    expect(html).not.toContain('Edit ×');
  });

  it('单个 tool_call 不包 group', () => {
    const turn = makeTurn([toolCall('Edit', 'completed', 'e1')]);
    const html = renderToStaticMarkup(<AssistantMessage turn={turn} />);
    expect(html).toContain('Edit');
    expect(html).not.toContain('×1');
    expect(html).not.toContain('Done');
  });

  it('整体状态：组内有 failed → 组徽章 error（aria-label=失败）', () => {
    const turn = makeTurn([
      toolCall('Edit', 'completed', 'e1'),
      toolCall('Edit', 'failed', 'e2'),
      toolCall('Edit', 'completed', 'e3'),
    ]);
    const html = renderToStaticMarkup(<AssistantMessage turn={turn} />);
    expect(html).toContain('Edit ×3');
    expect(html).toContain('Error');
    expect(html).toContain('aria-label="失败"');
  });

  it('text block 打断聚合（两侧同名 tool_call 不合并）', () => {
    const turn = makeTurn([
      toolCall('Edit', 'completed', 'e1'),
      { type: 'text', text: '中间穿插一段说明' },
      toolCall('Edit', 'completed', 'e2'),
    ]);
    const html = renderToStaticMarkup(<AssistantMessage turn={turn} />);
    // 被打断 → 两段各 1 个，不应出现聚合 ×N。
    expect(html).not.toContain('×2');
    expect(html).toContain('中间穿插一段说明');
  });
});
