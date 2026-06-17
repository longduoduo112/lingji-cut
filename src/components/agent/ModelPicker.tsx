/**
 * ModelPicker — composer 内的「当前 agent（只读）+ 当前模型（可切换）」紧凑芯片。
 *
 * 对齐 open-design 的 InlineModelSwitcher：单行芯片，左侧 AgentIcon + agent 名
 * （点击进设置，不在此切 agent —— 全局单 agent 由设置中心 T4 决定），分隔符，
 * 右侧当前模型 label + chevron。点击模型区展开下拉，列出该 agent 的静态
 * `models`，选中后 onChange(modelId)。
 *
 * 视觉：复用系统蓝 token，无第二 accent，自包含轻量 popover（不引 framer-motion
 * portal，便于 jsdom 测试与紧贴芯片定位）。models 为空/单项时仍显示当前模型。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getAgentPresentation } from '../../lib/agent-presentation';
import { useAgentModels } from '../../lib/use-agent-models';
import { AgentIcon } from './AgentIcon';

interface ModelPickerProps {
  /** 当前 agent id（只读展示，点击进设置）。 */
  agentId: string;
  /** 当前模型 id；缺省时回退到 presentation.defaultModel 或首个模型。 */
  value?: string;
  /** 模型切换回调。 */
  onChange: (modelId: string) => void;
  /** 点击 agent 区时触发（进入设置中心切换 agent）。 */
  onOpenAgentSettings?: () => void;
}

export function ModelPicker({
  agentId,
  value,
  onChange,
  onOpenAgentSettings,
}: ModelPickerProps): React.ReactElement {
  const presentation = useMemo(() => getAgentPresentation(agentId), [agentId]);
  // 动态拉取该 agent 的模型列表（pi 走 `pi --list-models`）；首屏 / 失败回退静态兜底。
  const { models, loading } = useAgentModels(agentId);

  // 当前模型 id：优先受控 value，其次 defaultModel，再次首个模型。
  const currentModelId = value ?? presentation.defaultModel ?? models[0]?.id;
  const currentModel = models.find((m) => m.id === currentModelId);
  const currentLabel = currentModel?.label ?? currentModelId ?? '默认模型';

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
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

  return (
    <div
      ref={rootRef}
      className="model-picker"
      data-agent-id={agentId}
      style={{ position: 'relative', display: 'inline-flex' }}
    >
      <div
        className="model-picker__chip"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 24,
          padding: '0 6px',
          borderRadius: 7,
          border: '1px solid var(--color-separator, rgba(255,255,255,0.12))',
          background: 'var(--color-fill-quaternary, rgba(120,120,128,0.12))',
          fontSize: 12,
          lineHeight: 1,
        }}
      >
        {/* Agent 区：只读，点击进设置 */}
        <button
          type="button"
          className="model-picker__agent"
          data-testid="model-picker-agent"
          onClick={() => onOpenAgentSettings?.()}
          title={`${presentation.displayName} — 在设置中切换 Agent`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: onOpenAgentSettings ? 'pointer' : 'default',
            color: 'var(--color-label, inherit)',
            font: 'inherit',
          }}
        >
          <AgentIcon agentId={agentId} size={14} />
          <span>{presentation.displayName}</span>
        </button>

        <span
          aria-hidden="true"
          style={{ width: 1, height: 12, background: 'var(--color-separator, rgba(255,255,255,0.18))' }}
        />

        {/* 模型区：可下拉切换 */}
        <button
          type="button"
          className="model-picker__model"
          data-testid="model-picker-model"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            color: 'var(--color-system-blue, #0A84FF)',
            font: 'inherit',
            fontWeight: 500,
          }}
        >
          <span>{currentLabel}</span>
          <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d="M2.5 4.5L6 8l3.5-3.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {open && (
        <div
          className="model-picker__menu"
          role="listbox"
          aria-label="选择模型"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 4px)',
            left: 0,
            minWidth: 180,
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
          {loading && (
            <div
              className="model-picker__loading"
              data-testid="model-picker-loading"
              style={{ padding: '6px 10px', fontSize: 12, color: 'var(--color-label-secondary, #98989d)' }}
            >
              加载模型…
            </div>
          )}
          {!loading && models.length === 0 && (
            <div
              className="model-picker__empty"
              style={{ padding: '6px 10px', fontSize: 12, color: 'var(--color-label-secondary, #98989d)' }}
            >
              {currentLabel}
            </div>
          )}
          {models.map((model) => {
            const selected = model.id === currentModelId;
            return (
              <button
                key={model.id}
                type="button"
                role="option"
                aria-selected={selected}
                data-model-id={model.id}
                onClick={() => {
                  onChange(model.id);
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
                <span style={{ flex: 1 }}>{model.label}</span>
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
