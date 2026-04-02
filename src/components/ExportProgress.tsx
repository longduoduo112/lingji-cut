interface ExportProgressProps {
  visible: boolean;
  progress: number;
  outputPath: string | null;
  errorMessage: string | null;
  onClose: () => void;
}

export function ExportProgress({
  visible,
  progress,
  outputPath,
  errorMessage,
  onClose,
}: ExportProgressProps) {
  if (!visible) {
    return null;
  }

  const isDone = progress >= 1 && !errorMessage;
  const canDismiss = isDone || Boolean(errorMessage);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.62)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 100,
      }}
    >
      <div
        style={{
          width: 420,
          borderRadius: 24,
          border: '1px solid rgba(255,255,255,0.08)',
          background: '#0b1220',
          padding: 28,
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: '0.16em', color: '#91a2bc' }}>EXPORT</div>
        <h3 style={{ margin: '10px 0 14px', fontSize: 26 }}>
          {errorMessage ? '导出失败' : isDone ? '导出完成' : '正在导出视频'}
        </h3>

        <div
          style={{
            height: 10,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.08)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.max(2, Math.round(progress * 100))}%`,
              background: errorMessage
                ? 'linear-gradient(90deg, #ff6e6e 0%, #ff9d6e 100%)'
                : 'linear-gradient(90deg, #7bd5ff 0%, #5fa4ff 100%)',
              transition: 'width 0.2s ease',
            }}
          />
        </div>

        <div style={{ marginTop: 14, color: errorMessage ? '#ffb2b2' : '#8da0bb', fontSize: 14 }}>
          {errorMessage || (isDone ? outputPath : `${Math.round(progress * 100)}%`)}
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          {isDone && outputPath ? (
            <button
              onClick={() => window.electronAPI.showItemInFolder(outputPath)}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 14,
                border: 'none',
                background: 'linear-gradient(90deg, #7bd5ff 0%, #5fa4ff 100%)',
                color: '#07111f',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              在 Finder 中显示
            </button>
          ) : null}
          {canDismiss ? (
            <button
              onClick={onClose}
              style={{
                flex: isDone && outputPath ? 1 : undefined,
                height: 44,
                padding: '0 18px',
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                color: '#f5f7fb',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              关闭
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
