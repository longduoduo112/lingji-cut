// @vitest-environment jsdom
//
// SessionListPane 增强测试（搜索 / agent 图标 / 重命名）。
// 结构断言用 SSR（renderToStaticMarkup），交互用 jsdom + createRoot + act。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  SessionListPane,
  filterConversations,
} from '../src/components/agent/SessionListPane';

// 让 React 在 jsdom 下识别 act() 边界，避免 "not configured to support act" 噪声。
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const renameConversation = vi.fn(() => Promise.resolve({} as never));

function makeConversations() {
  return [
    {
      id: 101,
      title: '产品发布脚本',
      agentType: 'claude',
      status: 'active',
      externalId: null,
    },
    {
      id: 102,
      title: '播客分镜讨论',
      agentType: 'codex',
      status: 'draft_local',
      externalId: 'resume-102',
    },
  ];
}

vi.mock('../src/hooks/use-conversation-list', () => ({
  useConversationList: () => ({
    conversations: makeConversations(),
    activeConversationId: 101,
    loading: false,
    error: null,
    renameConversation,
  }),
}));

afterEach(() => {
  renameConversation.mockClear();
});

describe('filterConversations', () => {
  it('returns all conversations for an empty query', () => {
    const list = makeConversations();
    expect(filterConversations(list, '')).toHaveLength(2);
    expect(filterConversations(list, '   ')).toHaveLength(2);
  });

  it('filters by case-insensitive title includes', () => {
    const list = makeConversations();
    const result = filterConversations(list, '播客');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('播客分镜讨论');
  });

  it('returns nothing when no title matches', () => {
    expect(filterConversations(makeConversations(), '不存在的关键词')).toHaveLength(0);
  });
});

describe('SessionListPane rendering', () => {
  it('renders a search input and agent icons per conversation', () => {
    const html = renderToStaticMarkup(
      <SessionListPane
        collapsed={false}
        explicitConversationId={null}
        onSelectConversation={() => undefined}
        onCreateConversation={() => undefined}
        onDeleteConversation={() => undefined}
      />,
    );

    expect(html).toContain('data-collapsed="false"');
    expect(html).toContain('aria-label="搜索会话"');
    expect(html).toContain('产品发布脚本');
    expect(html).toContain('删除会话');
    // AgentIcon 按 agentType 渲染（claude / codex）
    expect(html).toContain('aria-label="Claude"');
    expect(html).toContain('aria-label="Codex"');
  });

  it('renders collapsed rail with agent icons', () => {
    const html = renderToStaticMarkup(
      <SessionListPane
        collapsed
        explicitConversationId={null}
        onSelectConversation={() => undefined}
        onCreateConversation={() => undefined}
        onDeleteConversation={() => undefined}
      />,
    );

    expect(html).toContain('data-collapsed="true"');
    expect(html).toContain('aria-label="打开产品发布脚本"');
    expect(html).not.toContain('删除会话');
  });
});

describe('SessionListPane interactions', () => {
  function mount() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <SessionListPane
          collapsed={false}
          explicitConversationId={null}
          onSelectConversation={() => undefined}
          onCreateConversation={() => undefined}
          onDeleteConversation={() => undefined}
        />,
      );
    });
    return { container, root };
  }

  it('filters the visible rows when typing in the search box', () => {
    const { container, root } = mount();

    expect(container.textContent).toContain('产品发布脚本');
    expect(container.textContent).toContain('播客分镜讨论');

    const input = container.querySelector<HTMLInputElement>('input[aria-label="搜索会话"]')!;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )!.set!;
    act(() => {
      setter.call(input, '播客');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(container.textContent).toContain('播客分镜讨论');
    expect(container.textContent).not.toContain('产品发布脚本');

    act(() => root.unmount());
    container.remove();
  });

  it('enters rename mode on double click and commits on Enter', () => {
    const { container, root } = mount();

    const titleButton = Array.from(container.querySelectorAll('button')).find((el) =>
      el.textContent?.includes('产品发布脚本'),
    )!;
    act(() => {
      titleButton.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });

    const renameInput = container.querySelector<HTMLInputElement>('input[aria-label="重命名会话"]');
    expect(renameInput).not.toBeNull();

    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )!.set!;
    act(() => {
      setter.call(renameInput!, '改名后的标题');
      renameInput!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => {
      renameInput!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
    });

    expect(renameConversation).toHaveBeenCalledWith(101, '改名后的标题');

    act(() => root.unmount());
    container.remove();
  });
});
