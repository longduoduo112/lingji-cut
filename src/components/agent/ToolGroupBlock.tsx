/**
 * ToolGroupBlock — 连续同名工具调用的聚合卡（open-design ToolGroupCard 风格）。
 *
 * AssistantMessage 在 block 分发层把**连续的**同名 `tool_call` 归为一组：
 *  - 组内仅 1 个 → 直接渲染单卡 <ToolCallBlock>（不包 group，由 AssistantMessage 处理）。
 *  - 组内 ≥2 个同名 → 渲染本组件：可折叠卡头显示 summary（`{title} ×{n}` + 整体状态），
 *    展开后列出各 <ToolCallBlock>。
 *
 * 视觉对齐 T3 的 op-card / ThinkingBlock：系统蓝 accent、状态色语义、复用单卡渲染。
 */

import { useState } from 'react';
import { ChevronRight, ChevronDown, Check, X } from 'lucide-react';
import { Spinner } from '../../ui/primitives/Spinner';
import { ToolCallBlock } from './ToolCallBlock';

interface ToolCallBlockType {
  type: 'tool_call';
  toolCallId: string;
  title: string;
  kind: string;
  status: string;
  rawInput?: string;
  rawOutput?: string;
}

type GroupStatusKind = 'running' | 'ok' | 'error';

// 与 ToolCallBlock.classifyStatus 同语义：pending / in_progress / running → running；
// failed / error → error；completed / done / success / ok → ok。
function classifyStatus(status: string): GroupStatusKind {
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'done' || s === 'success' || s === 'ok') return 'ok';
  if (s === 'failed' || s === 'error') return 'error';
  return 'running';
}

/**
 * 整体状态聚合：组内任一 running/pending → running；任一 failed/error → error；全 completed → ok。
 * 优先级：running > error > ok（运行中优先表达，避免提前下结论；其次暴露失败）。
 */
export function aggregateStatus(blocks: ToolCallBlockType[]): GroupStatusKind {
  let hasError = false;
  for (const b of blocks) {
    const k = classifyStatus(b.status);
    if (k === 'running') return 'running';
    if (k === 'error') hasError = true;
  }
  return hasError ? 'error' : 'ok';
}

/** summary 状态文案：running=Running / ok=Done / error=Error。 */
function summaryLabel(kind: GroupStatusKind): string {
  if (kind === 'running') return 'Running';
  if (kind === 'error') return 'Error';
  return 'Done';
}

/** 组徽章：24×24 圆角方块。running=系统蓝 spinner / ok=绿 check / error=红 X。 */
function GroupStatusBadge({ kind }: { kind: GroupStatusKind }) {
  if (kind === 'running') {
    return (
      <span
        className="flex items-center justify-center w-6 h-6 rounded-md bg-[#0A84FF]/12 flex-shrink-0"
        title="运行中"
        aria-label="运行中"
      >
        <Spinner size={14} color="#0A84FF" />
      </span>
    );
  }
  if (kind === 'ok') {
    return (
      <span
        className="flex items-center justify-center w-6 h-6 rounded-md bg-[#30D158]/15 text-[#30D158] flex-shrink-0"
        title="已完成"
        aria-label="已完成"
      >
        <Check size={14} strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <span
      className="flex items-center justify-center w-6 h-6 rounded-md bg-[#FF453A]/15 text-[#FF453A] flex-shrink-0"
      title="失败"
      aria-label="失败"
    >
      <X size={14} strokeWidth={2.5} />
    </span>
  );
}

export function ToolGroupBlock({ blocks }: { blocks: ToolCallBlockType[] }) {
  const statusKind = aggregateStatus(blocks);
  const isRunning = statusKind === 'running';
  const title = blocks[0]?.title ?? '工具调用';
  // 默认折叠；失败态默认展开以暴露错误细节（与 ToolCallBlock 一致）。
  const [expanded, setExpanded] = useState(statusKind === 'error');

  return (
    <div className="relative rounded-lg overflow-hidden border border-white/[0.06] bg-mac-elevated transition-colors">
      {/* 左侧 accent 条：运行中点亮系统蓝（与 ToolCallBlock / ThinkingBlock 同款）。 */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-[2px] transition-colors ${
          isRunning ? 'bg-[#0A84FF]' : 'bg-white/10'
        }`}
      />

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-2 w-full text-left pl-2.5 pr-3 py-2 bg-transparent border-none cursor-pointer hover:bg-white/[0.03] transition-colors"
        aria-expanded={expanded}
      >
        <GroupStatusBadge kind={statusKind} />
        <span
          className={`text-xs font-semibold text-foreground flex-1 truncate ${
            isRunning ? 'shimmer-text' : ''
          }`}
        >
          {title} ×{blocks.length}
        </span>
        <span className="text-[10px] text-mac-text-sec/70 tracking-wide flex-shrink-0">
          {summaryLabel(statusKind)}
        </span>
        <span className="text-mac-text-sec flex-shrink-0" aria-hidden>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
      </button>

      {expanded ? (
        <div className="border-t border-white/[0.06] flex flex-col gap-1.5 p-1.5">
          {blocks.map((block, index) => (
            <ToolCallBlock key={block.toolCallId || index} block={block} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
