import { useDeferredValue, useState } from 'react';
import { MessageSquare, RotateCcw, Search, Trash2 } from 'lucide-react';
import { Button, EmptyState } from '../../ui';
import { useConversationList } from '../../hooks/use-conversation-list';
import { AgentIcon } from './AgentIcon';
import type { ConversationSummary } from '../../types/conversation';

interface SessionListPaneProps {
  collapsed?: boolean;
  explicitConversationId: number | null;
  onSelectConversation: (conversationId: number) => void;
  onCreateConversation: () => void;
  onDeleteConversation: (conversationId: number) => void;
}

function formatStatus(status: string): string {
  switch (status) {
    case 'draft_local':
      return '草稿';
    case 'active':
      return '进行中';
    case 'archived':
      return '已归档';
    default:
      return status;
  }
}

/**
 * 按标题过滤会话列表（大小写不敏感的 includes）。空查询返回原列表。
 * 抽成纯函数便于在 node 测试环境直接断言过滤逻辑。
 */
export function filterConversations<T extends { title: string }>(
  conversations: T[],
  query: string,
): T[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return conversations;
  return conversations.filter((conversation) =>
    (conversation.title ?? '').toLowerCase().includes(trimmed),
  );
}

export function SessionListPane({
  collapsed = false,
  explicitConversationId,
  onSelectConversation,
  onCreateConversation,
  onDeleteConversation,
}: SessionListPaneProps) {
  const {
    conversations,
    activeConversationId,
    loading,
    error,
    renameConversation,
  } = useConversationList();

  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  function beginRename(conversation: Pick<ConversationSummary, 'id' | 'title'>) {
    setRenamingId(conversation.id);
    setRenameDraft(conversation.title);
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameDraft('');
  }

  function commitRename(conversationId: number) {
    const next = renameDraft.trim();
    const original = conversations.find((c) => c.id === conversationId)?.title ?? '';
    if (next && next !== original) {
      void renameConversation?.(conversationId, next);
    }
    cancelRename();
  }

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-3 text-xs text-mac-text-muted/60">
        正在加载会话列表...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 overflow-y-auto p-3 text-xs text-mac-red/70">
        会话列表加载失败：{error}
      </div>
    );
  }

  if (conversations.length === 0) {
    if (collapsed) {
      return (
        <div
          className="flex-1 overflow-y-auto px-2 py-3 flex items-start justify-center"
          data-collapsed="true"
        >
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-mac-text-muted/50"
            aria-hidden="true"
          >
            <MessageSquare size={14} />
          </span>
        </div>
      );
    }

    return (
      <div
        className="flex-1 overflow-y-auto p-4 flex items-center justify-center"
        data-collapsed="false"
      >
        <EmptyState
          eyebrow={<MessageSquare size={18} />}
          title="当前项目还没有会话"
          actions={
            <button
              type="button"
              onClick={onCreateConversation}
              className="text-mac-blue hover:underline bg-transparent border-none cursor-pointer text-xs"
            >
              创建第一个会话
            </button>
          }
        />
      </div>
    );
  }

  if (collapsed) {
    return (
      <div
        className="flex-1 overflow-y-auto px-2 py-2 flex flex-col items-center gap-2"
        data-collapsed="true"
      >
        {conversations.map((conversation) => {
          const isActive = activeConversationId === conversation.id;
          const isExplicit = explicitConversationId === conversation.id;
          return (
            <Button
              key={conversation.id}
              type="button"
              variant={isActive ? 'accent' : 'ghost'}
              size="sm"
              iconOnly
              className="relative"
              onClick={() => onSelectConversation(conversation.id)}
              aria-label={`打开${conversation.title}`}
              title={conversation.title}
            >
              <AgentIcon agentId={conversation.agentType} size={14} />
              {isExplicit ? (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-mac-blue" />
              ) : null}
            </Button>
          );
        })}
      </div>
    );
  }

  const visibleConversations = filterConversations(conversations, deferredQuery);

  return (
    <div className="flex-1 min-h-0 flex flex-col" data-collapsed="false">
      <div className="px-2 pt-2 pb-1.5">
        <label className="relative flex items-center">
          <span className="pointer-events-none absolute left-2.5 text-mac-text-muted/50" aria-hidden="true">
            <Search size={13} />
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索会话"
            aria-label="搜索会话"
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] py-1.5 pl-7 pr-2 text-[12px] text-white placeholder:text-mac-text-muted/40 outline-none focus:border-mac-blue/50"
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-1.5">
        {visibleConversations.length === 0 ? (
          <div className="px-2 py-4 text-center text-[11px] text-mac-text-muted/50">
            没有匹配「{deferredQuery}」的会话
          </div>
        ) : (
          visibleConversations.map((conversation) => {
            const isActive = activeConversationId === conversation.id;
            const isExplicit = explicitConversationId === conversation.id;
            const isRenaming = renamingId === conversation.id;
            return (
              <div
                key={conversation.id}
                className={`w-full text-left rounded-xl px-3 py-2.5 border transition-colors ${
                  isActive
                    ? 'bg-mac-blue/10 border-mac-blue/40'
                    : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-mac-text-muted/70">
                    <AgentIcon agentId={conversation.agentType} size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    {isRenaming ? (
                      <input
                        type="text"
                        autoFocus
                        value={renameDraft}
                        aria-label="重命名会话"
                        onChange={(event) => setRenameDraft(event.target.value)}
                        onBlur={() => commitRename(conversation.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            commitRename(conversation.id);
                          } else if (event.key === 'Escape') {
                            event.preventDefault();
                            cancelRename();
                          }
                        }}
                        className="w-full rounded-md border border-mac-blue/50 bg-white/[0.04] px-1.5 py-0.5 text-[13px] font-medium text-white outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelectConversation(conversation.id)}
                        onDoubleClick={() => beginRename(conversation)}
                        title="双击重命名"
                        className="block w-full text-left bg-transparent border-none p-0"
                      >
                        <div className="text-[13px] font-medium text-white truncate">
                          {conversation.title}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-mac-text-muted/60">
                          <span>{formatStatus(conversation.status)}</span>
                          {conversation.externalId ? (
                            <span className="inline-flex items-center gap-1">
                              <RotateCcw size={10} />
                              可恢复
                            </span>
                          ) : null}
                          {isExplicit ? (
                            <span className="text-mac-blue/90 shrink-0">已进入</span>
                          ) : null}
                        </div>
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-md p-1 text-mac-text-muted/50 hover:text-mac-red/80 hover:bg-white/[0.04]"
                    title="删除会话"
                    onClick={() => onDeleteConversation(conversation.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
