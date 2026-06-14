/**
 * ChatComposer — 对话输入薄封装。
 *
 * 复用现有 `MessageInput` 的全部能力（文本输入、斜杠命令、@ 文件提及、
 * 附件/图片、模式/配置选择器、取消、发送），不做重写。
 *
 * 唯一新增能力：在「新建会话尚未绑定 agent」场景下，于输入框上方渲染
 * `<AgentPicker/>`，让用户显式选择 Claude / Codex / Pi。
 *
 * 设计取舍：保持对外接口与 MessageInput 完全兼容（透传所有 props），
 * 仅扩展三个与 agent 选择相关的新 prop。被 B8 ChatPane 使用；现有
 * ConversationDetailPane 继续直接使用 MessageInput，互不影响。
 */

import React from 'react';
import { MessageInput, type MessageInputProps } from './MessageInput';
import { AgentPicker } from './AgentPicker';
import { ModelPicker } from './ModelPicker';

export interface ChatComposerProps extends MessageInputProps {
  /** 是否在输入框上方显示 agent 选择器（仅新建会话/未绑定 agent 时为 true）。 */
  showAgentPicker?: boolean;
  /** 当前选中的 agent id，透传给 AgentPicker。 */
  selectedAgentId?: string;
  /** agent 选择变更回调。 */
  onAgentChange?: (agentId: string) => void;
  /**
   * 当前 agent id（用于在输入框下方渲染模型选择芯片）。有值时显示 ModelPicker。
   * 与 selectedAgentId 区分语义：selectedAgentId 用于「新建会话选 agent」场景，
   * agentId 用于「已绑定会话切模型」的常驻芯片。
   */
  agentId?: string;
  /** 当前模型 id（受控）；缺省时 ModelPicker 用 presentation.defaultModel。 */
  modelId?: string;
  /** 模型切换回调。 */
  onModelChange?: (modelId: string) => void;
  /** 点击芯片 agent 区进入设置中心切换 agent。 */
  onOpenAgentSettings?: () => void;
}

export function ChatComposer({
  showAgentPicker = false,
  selectedAgentId,
  onAgentChange,
  agentId,
  modelId,
  onModelChange,
  onOpenAgentSettings,
  ...messageInputProps
}: ChatComposerProps): React.ReactElement {
  return (
    <div className="chat-composer flex flex-col gap-2">
      {showAgentPicker && (
        <div className="chat-composer__agent-picker">
          <AgentPicker
            value={selectedAgentId ?? ''}
            onChange={(id) => onAgentChange?.(id)}
          />
        </div>
      )}
      <MessageInput {...messageInputProps} />
      {agentId && (
        <div className="chat-composer__model-picker">
          <ModelPicker
            agentId={agentId}
            value={modelId}
            onChange={(id) => onModelChange?.(id)}
            onOpenAgentSettings={onOpenAgentSettings}
          />
        </div>
      )}
    </div>
  );
}
