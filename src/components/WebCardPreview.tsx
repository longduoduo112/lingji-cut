import { useMemo } from 'react';
import { normalizeWebCardSrcDoc } from '../lib/web-card';

const DEFAULT_STAGE_WIDTH = 1_920;
const DEFAULT_STAGE_HEIGHT = 1_080;

interface WebCardPreviewProps {
  srcDoc?: string;
  stageWidth?: number;
  stageHeight?: number;
}

export function WebCardPreview({
  srcDoc,
  stageWidth = DEFAULT_STAGE_WIDTH,
  stageHeight = DEFAULT_STAGE_HEIGHT,
}: WebCardPreviewProps) {
  const aspectRatio = useMemo(
    () => `${Math.max(1, stageWidth)} / ${Math.max(1, stageHeight)}`,
    [stageHeight, stageWidth],
  );
  const normalizedSrcDoc = useMemo(
    () => (srcDoc ? normalizeWebCardSrcDoc(srcDoc, stageWidth, stageHeight) : undefined),
    [srcDoc, stageWidth, stageHeight],
  );

  if (!normalizedSrcDoc) {
    return (
      <div
        style={{
          ...emptyStyle,
          aspectRatio,
        }}
      >
        网页卡片预览将在分析或单卡重生成后显示
      </div>
    );
  }

  return (
    <div
      style={{
        ...frameShellStyle,
        aspectRatio,
      }}
    >
      <iframe
        title="网页卡片预览"
        srcDoc={normalizedSrcDoc}
        style={{
          ...frameStyle,
        }}
      />
    </div>
  );
}

const frameShellStyle = {
  width: '100%',
  position: 'relative' as const,
  overflow: 'hidden' as const,
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.08)',
  background:
    'radial-gradient(circle at top, rgba(148,163,184,0.12) 0%, rgba(2,6,23,0.96) 72%)',
};

const frameStyle = {
  position: 'absolute' as const,
  inset: 0,
  width: '100%',
  height: '100%',
  border: 'none',
  background: '#020617',
  display: 'block',
  pointerEvents: 'none' as const,
};

const emptyStyle = {
  width: '100%',
  borderRadius: 16,
  border: '1px dashed rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.02)',
  color: '#94a3b8',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center' as const,
  padding: 20,
  boxSizing: 'border-box' as const,
};
