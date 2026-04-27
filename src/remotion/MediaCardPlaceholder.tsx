import type { CSSProperties } from 'react';

interface Props {
  type: 'image' | 'video';
  status?: string;
}

const wrap: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  background: '#1a1f2b',
  color: '#cdd5e1',
  fontSize: 36,
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

export function MediaCardPlaceholder({ type, status }: Props) {
  return (
    <div style={wrap} data-testid="media-card-placeholder">
      <span>
        {type === 'image' ? '图片卡' : '视频卡'} · {status ?? '生成中'}
      </span>
    </div>
  );
}
