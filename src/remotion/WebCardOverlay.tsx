import { useMemo, type CSSProperties } from 'react';
import { normalizeWebCardSrcDoc } from '../lib/web-card';

interface WebCardOverlayProps {
  srcDoc: string;
  style?: CSSProperties;
}

export function WebCardOverlay({ srcDoc, style }: WebCardOverlayProps) {
  const normalizedSrcDoc = useMemo(() => normalizeWebCardSrcDoc(srcDoc), [srcDoc]);

  return (
    <iframe
      title="AI 网页卡片"
      srcDoc={normalizedSrcDoc}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        background: '#020617',
        ...style,
      }}
    />
  );
}
