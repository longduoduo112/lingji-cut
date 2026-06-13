/**
 * ChatPane — 对话容器，替换 ConversationDetailPane（B8）。
 *
 * 职责拆分：
 *  - 数据/连接：原样复用 useConversationDetail + useConnectionLifecycle（不改数据流）。
 *  - ChatHeader：标题 + 连接状态 + 上下文用量 + 可恢复标记 + 当前 agent 名/图标。
 *  - 消息区：MessageList（B5），承接原内联 turns.map + PermissionPrompt。
 *  - 底部：ChatComposer（B6），透传原 MessageInput 全部 props。
 *
 * 权限卡位置决策：旧 pane 把 PermissionPrompt 常驻在输入框上方（pane 级）。
 * B5 MessageList 已把权限卡挂到最后一个 assistant turn（无 assistant turn 时
 * 在列表末尾兜底渲染），并在 turns / pendingPermission 变化时自动滚到底。
 * 因此这里改为「权限卡随消息区滚动」，pendingPermission 时仍可见且会滚到，
 * 行为不回归，且消除了 pane 级与 block 级两处重复的 PermissionPrompt。
 *
 * 本任务 showAgentPicker 固定为 false：已存在会话不换 agent；
 * 新建会话选 agent 由 B9 在新建流程中处理。
 */

import { useCallback, useMemo } from 'react';
import { EmptyState } from '../../ui';
import { useConversationDetail } from '../../hooks/use-conversation-detail';
import { useConnectionLifecycle } from '../../hooks/use-connection-lifecycle';
import type { PromptInputBlock } from '../../../electron/acp/types';
import { AgentIcon } from './AgentIcon';
import { MessageList } from './MessageList';
import { ChatComposer } from './ChatComposer';

interface ChatPaneProps {
  projectDir: string | null;
  explicitActivated: boolean;
}

function formatConnectionStatus(status: string): string {
  switch (status) {
    case 'disconnected':
      return '未连接';
    case 'connecting':
      return '连接中...';
    case 'connected':
      return '已连接';
    case 'prompting':
      return '思考中...';
    case 'error':
      return '连接失败';
    default:
      return status;
  }
}

/** agentId → 展示名（与 AssistantMessage 一致）。 */
function agentDisplayName(agentId: string): string {
  const normalized = agentId.toLowerCase().replace(/-acp$/, '');
  switch (normalized) {
    case 'claude':
      return 'Claude';
    case 'codex':
      return 'Codex';
    case 'pi':
      return 'Pi';
    default:
      return '助手';
  }
}

interface ChatHeaderProps {
  title: string;
  connectionStatus: string;
  resumable: boolean;
  usageLabel: string | null;
  agentType?: string;
  showConnectHint: boolean;
}

function ChatHeader({
  title,
  connectionStatus,
  resumable,
  usageLabel,
  agentType,
  showConnectHint,
}: ChatHeaderProps) {
  return (
    <div className="px-4 py-3 border-b border-mac-separator shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        {agentType ? <AgentIcon agentId={agentType} size={16} /> : null}
        <div className="text-sm font-semibold text-white truncate">{title}</div>
        {agentType ? (
          <span className="text-[11px] text-mac-text-muted/60 shrink-0">
            {agentDisplayName(agentType)}
          </span>
        ) : null}
      </div>
      <div className="mt-1 flex items-center gap-3 text-[11px] text-mac-text-muted/60">
        <span>{formatConnectionStatus(connectionStatus)}</span>
        {resumable ? <span>可恢复历史会话</span> : <span>新会话</span>}
        {usageLabel ? <span>{usageLabel}</span> : null}
      </div>
      {showConnectHint ? (
        <div className="mt-2 text-[11px] text-mac-text-muted/50">
          当前仅展示会话内容。点击左侧会话或发送消息后，才会建立 ACP 连接。
        </div>
      ) : null}
    </div>
  );
}

export function ChatPane({ projectDir, explicitActivated }: ChatPaneProps) {
  const { conversationId, detail, runtime, loading, error } = useConversationDetail();
  const connection = useConnectionLifecycle({
    conversationId: conversationId ?? -1,
    projectDir: projectDir ?? undefined,
    sessionId: detail?.externalId ?? null,
    agentType: detail?.agentType,
    isActive: explicitActivated && conversationId !== null,
    autoConnectOnActive: explicitActivated && conversationId !== null,
  });

  const isPrompting = connection.status === 'prompting';
  const turns = runtime?.turns ?? [];
  const usageLabel = useMemo(() => {
    if (!runtime?.usage || runtime.usage.size <= 0) return null;
    const percent = (runtime.usage.used / runtime.usage.size) * 100;
    return `上下文 ${Math.max(0, Math.min(100, percent)).toFixed(1)}%`;
  }, [runtime?.usage]);

  const ensureConnected = useCallback(async () => {
    if (!conversationId || !projectDir) return;
    if (connection.status === 'connected' || connection.status === 'prompting') return;
    await connection.connect({
      projectDir,
      sessionId: detail?.externalId ?? null,
      agentType: detail?.agentType,
    });
  }, [conversationId, projectDir, connection, detail]);

  const handleSend = useCallback(
    async (blocks: PromptInputBlock[]) => {
      if (!conversationId || !projectDir) return;
      await ensureConnected();
      await connection.send(blocks);
    },
    [conversationId, projectDir, ensureConnected, connection],
  );

  if (conversationId === null) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <EmptyState
          title="尚未选择会话"
          description="先创建一个会话，或者从左侧选择一个已有会话。"
        />
      </div>
    );
  }

  if (loading && !detail) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-mac-text-muted/60">
        正在加载会话详情...
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-mac-red/70 px-6 text-center">
        会话详情加载失败：{error}
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col">
      <ChatHeader
        title={detail?.title ?? `会话 ${conversationId}`}
        connectionStatus={connection.status}
        resumable={Boolean(detail?.externalId)}
        usageLabel={usageLabel}
        agentType={detail?.agentType}
        showConnectHint={!explicitActivated}
      />

      <MessageList
        turns={turns}
        pendingPermission={connection.pendingPermission}
        onRespondPermission={(requestId, optionId) =>
          void connection.respondPermission(requestId, optionId)
        }
        fallbackAgentId={detail?.agentType}
        isStreaming={isPrompting}
      />

      <div className="px-3 py-3 border-t border-mac-separator shrink-0 flex flex-col gap-1.5">
        {connection.autoConnectError ? (
          <div className="text-[11px] text-mac-red/70 px-1">
            连接失败：{connection.autoConnectError}
          </div>
        ) : null}
        <ChatComposer
          showAgentPicker={false}
          onSend={(blocks) => void handleSend(blocks)}
          onCancel={isPrompting ? () => void connection.cancel() : undefined}
          disabled={conversationId === null || !projectDir}
          isPrompting={isPrompting}
          autoFocus={explicitActivated && conversationId !== null}
          placeholder={
            isPrompting
              ? 'Agent 正在思考中，按 Enter 追加消息…'
              : '输入消息开始对话… 可粘贴或拖拽文件'
          }
          projectDir={projectDir}
          availableCommands={connection.availableCommands}
          configOptions={connection.configOptions}
          onConfigOptionChange={(configId, valueId) =>
            void connection.setConfigOption(configId, valueId)
          }
          availableModes={connection.availableModes}
          currentModeId={connection.currentModeId}
          onModeChange={(modeId) => void connection.setMode(modeId)}
        />
        {!explicitActivated ? (
          <div className="text-[10px] text-mac-text-muted/40 px-1">
            发送消息后自动建立 ACP 连接
          </div>
        ) : null}
      </div>
    </div>
  );
}
