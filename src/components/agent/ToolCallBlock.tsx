import { useState } from 'react';
import { ChevronRight, ChevronDown, Check, X } from 'lucide-react';
import { Spinner } from '../../ui/primitives/Spinner';

interface ToolCallBlockType {
  type: 'tool_call';
  toolCallId: string;
  title: string;
  kind: string;
  status: string;
  rawInput?: string;
  rawOutput?: string;
}

type StatusKind = 'running' | 'ok' | 'error';

// ACP ToolCallStatus：pending / in_progress / completed / failed。
// 兼容历史/别名取值（running / done / error），统一映射到三态徽章。
function classifyStatus(status: string): StatusKind {
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'done' || s === 'success' || s === 'ok') return 'ok';
  if (s === 'failed' || s === 'error') return 'error';
  // pending / in_progress / running 及未知态都按运行中处理。
  return 'running';
}

/** 状态徽章：24×24 圆角方块。running=系统蓝 spinner / ok=绿 check / error=红 X。 */
function StatusBadge({ kind }: { kind: StatusKind }) {
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

export function ToolCallBlock({ block }: { block: ToolCallBlockType }) {
  const statusKind = classifyStatus(block.status);
  const isRunning = statusKind === 'running';
  const hasDetail = Boolean(block.rawInput || block.rawOutput);
  // 默认折叠；失败态默认展开以暴露错误细节。
  const [expanded, setExpanded] = useState(statusKind === 'error');

  return (
    <div className="relative rounded-lg overflow-hidden border border-white/[0.06] bg-mac-elevated transition-colors">
      {/* 左侧 accent 条：运行中点亮系统蓝（与 ThinkingBlock 同款）。 */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-[2px] transition-colors ${
          isRunning ? 'bg-[#0A84FF]' : 'bg-white/10'
        }`}
      />

      <button
        type="button"
        onClick={() => hasDetail && setExpanded((e) => !e)}
        disabled={!hasDetail}
        className={`flex items-center gap-2 w-full text-left pl-2.5 pr-3 py-2 bg-transparent border-none transition-colors ${
          hasDetail ? 'cursor-pointer hover:bg-white/[0.03]' : 'cursor-default'
        }`}
      >
        <StatusBadge kind={statusKind} />
        <span
          className={`text-xs font-semibold text-foreground flex-1 truncate ${
            isRunning && !block.rawOutput ? 'shimmer-text' : ''
          }`}
        >
          {block.title}
        </span>
        {block.kind ? (
          <span className="text-[10px] text-mac-text-sec/70 tracking-wide flex-shrink-0">
            {block.kind}
          </span>
        ) : null}
        {hasDetail ? (
          <span className="text-mac-text-sec flex-shrink-0" aria-hidden>
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        ) : null}
      </button>

      {hasDetail && expanded ? (
        <div className="border-t border-white/[0.06]">
          {block.rawInput ? (
            <div>
              <div className="px-3 pt-2 pb-1 text-[10px] font-medium tracking-wide text-mac-text-sec/70 uppercase">
                Input
              </div>
              <pre
                className="px-3 pb-2 m-0 text-[11px] text-mac-text-sec whitespace-pre-wrap break-all max-h-[200px] overflow-auto"
                style={{
                  fontFamily:
                    "'SF Mono', 'JetBrains Mono', Menlo, Consolas, 'PingFang SC', monospace",
                }}
              >
                {block.rawInput}
              </pre>
            </div>
          ) : null}
          {block.rawOutput ? (
            <div>
              <div className="px-3 pt-2 pb-1 text-[10px] font-medium tracking-wide text-mac-text-sec/70 uppercase">
                Output
              </div>
              <pre
                className="px-3 py-2 m-0 text-[11px] text-mac-text-sec whitespace-pre-wrap break-all max-h-[300px] overflow-auto bg-[#1A1A1C]"
                style={{
                  fontFamily:
                    "'SF Mono', 'JetBrains Mono', Menlo, Consolas, 'PingFang SC', monospace",
                }}
              >
                {block.rawOutput}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
