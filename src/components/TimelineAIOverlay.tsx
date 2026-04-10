import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { WorkflowState } from '../store/ai';

interface TimelineAIOverlayProps {
  workflow: WorkflowState;
  timelineContainerRef: RefObject<HTMLDivElement | null>;
  onCancel: () => void;
}

function FloatingAICursor({
  x,
  y,
  label,
}: {
  x: number;
  y: number;
  label: string;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        transform: 'translate(-50%, -100%)',
        zIndex: 1004,
        pointerEvents: 'none',
        transition: 'left 0.18s ease-out, top 0.18s ease-out',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        border: '1px solid rgba(167, 139, 250, 0.45)',
        background: 'rgba(88, 28, 135, 0.34)',
        color: '#ddd6fe',
        fontSize: 11,
        boxShadow: '0 10px 30px rgba(76, 29, 149, 0.28)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <span>{label}</span>
    </div>
  );
}

export function TimelineAIOverlay({
  workflow,
  timelineContainerRef,
  onCancel,
}: TimelineAIOverlayProps) {
  const [cursorPos, setCursorPos] = useState({ x: -200, y: -200 });
  const phaseRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const isVisible = workflow.step !== 'idle' && workflow.step !== 'done';
  const isError = workflow.step === 'error';
  const isArranging = workflow.step === 'arranging';

  useEffect(() => {
    if (!isVisible) {
      setCursorPos({ x: -200, y: -200 });
      return;
    }

    const tick = () => {
      const container = timelineContainerRef.current;
      if (!container) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }

      const rect = container.getBoundingClientRect();
      phaseRef.current = (phaseRef.current + 1.6) % 360;
      const normalized = (Math.sin((phaseRef.current * Math.PI) / 180) + 1) / 2;
      const x = rect.left + 80 + normalized * Math.max(rect.width - 160, 40);
      const y = rect.top + 36;
      setCursorPos({ x, y });
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [isVisible, timelineContainerRef]);

  if (!isVisible) {
    return null;
  }

  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1000,
          pointerEvents: isError ? 'all' : 'none',
          background: isError ? 'rgba(20, 20, 24, 0.08)' : 'rgba(12, 10, 20, 0.26)',
          transition: 'background 180ms ease',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1001,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: isError
            ? 'rgba(127, 29, 29, 0.22)'
            : 'linear-gradient(90deg, rgba(76, 29, 149, 0.52), rgba(59, 7, 100, 0.32))',
          borderBottom: `1px solid ${
            isError ? 'rgba(248, 113, 113, 0.28)' : 'rgba(196, 181, 253, 0.2)'
          }`,
          backdropFilter: 'blur(10px)',
        }}
      >
        {!isError ? (
          <div
            style={{
              width: 136,
              height: 5,
              flexShrink: 0,
              overflow: 'hidden',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.12)',
            }}
          >
            <div
              style={{
                width: `${workflow.progress}%`,
                height: '100%',
                borderRadius: 999,
                background: 'linear-gradient(90deg, #c084fc, #60a5fa)',
                boxShadow: '0 0 18px rgba(192, 132, 252, 0.45)',
                transition: 'width 200ms ease',
              }}
            />
          </div>
        ) : null}

        <span
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: 600,
            color: isError ? '#fecaca' : '#ede9fe',
          }}
        >
          {isError
            ? `AI 流程中断：${workflow.error ?? '发生未知错误'}`
            : `${workflow.stepLabel} ${Math.round(workflow.progress)}%`}
        </span>

        {workflow.canCancel ? (
          <button
            type="button"
            onClick={onCancel}
            style={{
              flexShrink: 0,
              borderRadius: 999,
              border: '1px solid rgba(221, 214, 254, 0.24)',
              background: 'rgba(255,255,255,0.08)',
              color: '#ede9fe',
              fontSize: 11,
              padding: '4px 10px',
              cursor: 'pointer',
            }}
          >
            取消
          </button>
        ) : null}
      </div>

      {isArranging ? (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            zIndex: 1002,
            transform: 'translate(-50%, -50%)',
            padding: '18px 22px',
            borderRadius: 18,
            border: '1px solid rgba(196, 181, 253, 0.22)',
            background:
              'linear-gradient(135deg, rgba(46, 16, 101, 0.92), rgba(30, 41, 59, 0.84))',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(15, 23, 42, 0.32)',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>AI</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#ddd6fe' }}>
            正在自动排布时间轴
          </div>
        </div>
      ) : null}

      {!isError ? (
        <FloatingAICursor
          x={cursorPos.x}
          y={cursorPos.y}
          label={isArranging ? 'AI 正在排布' : 'AI 处理中'}
        />
      ) : null}
    </>
  );
}
