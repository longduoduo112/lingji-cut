/**
 * ThinkingLevelPicker — composer 内的「思考程度」紧凑芯片。
 *
 * 与 ModelPicker 同款轻量 popover：左侧 Brain 图标 + 当前档位 label + chevron，
 * 点击展开下拉，列出该 agent 的 reasoningOptions（来自 runtime def）。仅当该 agent
 * 暴露 reasoningOptions（pi 即如此）时由 ChatComposer 渲染。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Brain } from 'lucide-react';
import { getAgentPresentation } from '../../lib/agent-presentation';

interface ThinkingLevelPickerProps {
  agentId: string;
  /** 当前档位 id；缺省回退 defaultReasoning 或首项。 */
  value?: string;
  onChange: (reasoningId: string) => void;
}

export function ThinkingLevelPicker({
  agentId,
  value,
  onChange,
}: ThinkingLevelPickerProps): React.ReactElement | null {
  const presentation = useMemo(() => getAgentPresentation(agentId), [agentId]);
  const options = presentation.reasoningOptions ?? [];

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  // 该 agent 不支持思考程度切换 → 不渲染。
  if (options.length === 0) return null;

  const currentId = value ?? presentation.defaultReasoning ?? options[0]?.id;
  const current = options.find((o) => o.id === currentId);
  const currentLabel = current?.label ?? currentId ?? '默认';

  return (
    <div
      ref={rootRef}
      className="thinking-level-picker"
      data-agent-id={agentId}
      style={{ position: 'relative', display: 'inline-flex' }}
    >
      <button
        type="button"
        data-testid="thinking-level-chip"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="思考程度"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          height: 24,
          padding: '0 7px',
          borderRadius: 7,
          border: '1px solid var(--color-separator, rgba(255,255,255,0.12))',
          background: 'var(--color-fill-quaternary, rgba(120,120,128,0.12))',
          fontSize: 12,
          lineHeight: 1,
          cursor: 'pointer',
          color: 'var(--color-label, inherit)',
        }}
      >
        <Brain size={13} style={{ color: 'var(--color-system-blue, #0A84FF)' }} aria-hidden />
        <span style={{ color: 'var(--color-label-secondary, #98989d)' }}>思考</span>
        <span style={{ color: 'var(--color-system-blue, #0A84FF)', fontWeight: 500 }}>{currentLabel}</span>
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M2.5 4.5L6 8l3.5-3.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: 'var(--color-system-blue, #0A84FF)' }}
          />
        </svg>
      </button>

      {open && (
        <div
          className="thinking-level-picker__menu"
          role="listbox"
          aria-label="选择思考程度"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 4px)',
            left: 0,
            minWidth: 140,
            maxHeight: 260,
            overflowY: 'auto',
            padding: 4,
            borderRadius: 10,
            border: '1px solid var(--color-separator, rgba(255,255,255,0.12))',
            background: 'var(--color-bg-elevated, #2c2c2e)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
            zIndex: 9999,
          }}
        >
          {options.map((opt) => {
            const selected = opt.id === currentId;
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={selected}
                data-reasoning-id={opt.id}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: 7,
                  border: 'none',
                  background: selected ? 'var(--color-system-blue, #0A84FF)' : 'transparent',
                  color: selected ? '#fff' : 'var(--color-label, inherit)',
                  fontSize: 12,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span style={{ flex: 1 }}>{opt.label}</span>
                {selected && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path
                      d="M2.5 6.5L5 9l4.5-5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
