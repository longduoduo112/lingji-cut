type ConflictResolution = 'mine' | 'external';

interface ConflictDialogProps {
  open: boolean;
  files: string[];
  resolutions: Record<string, ConflictResolution>;
  onChangeResolution: (file: string, resolution: ConflictResolution) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConflictDialog({
  open,
  files,
  resolutions,
  onChangeResolution,
  onCancel,
  onConfirm,
}: ConflictDialogProps) {
  if (!open || !files.length) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.45)',
        zIndex: 140,
      }}
    >
      <div
        style={{
          width: 520,
          maxWidth: 'calc(100% - 32px)',
          borderRadius: 14,
          border: '1px solid var(--color-border-subtle)',
          background: 'var(--color-panel-bg)',
          boxShadow: '0 18px 50px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>检测到外部文件冲突</div>
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            这些文件在你编辑期间被外部修改了。保存前请决定保留当前版本还是使用外部版本。
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 18 }}>
          {files.map((file) => (
            <div
              key={file}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid var(--color-border-subtle)',
                background: 'var(--color-window-bg)',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600 }}>{file}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => onChangeResolution(file, 'mine')}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: resolutions[file] === 'mine'
                      ? '1px solid var(--color-selection-blue, #0a84ff)'
                      : '1px solid var(--color-border-subtle)',
                    background: resolutions[file] === 'mine'
                      ? 'color-mix(in srgb, var(--color-selection-blue, #0a84ff) 12%, transparent)'
                      : 'transparent',
                    color: resolutions[file] === 'mine'
                      ? 'var(--color-selection-blue, #0a84ff)'
                      : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  使用我的版本
                </button>
                <button
                  type="button"
                  onClick={() => onChangeResolution(file, 'external')}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: resolutions[file] === 'external'
                      ? '1px solid var(--color-selection-blue, #0a84ff)'
                      : '1px solid var(--color-border-subtle)',
                    background: resolutions[file] === 'external'
                      ? 'color-mix(in srgb, var(--color-selection-blue, #0a84ff) 12%, transparent)'
                      : 'transparent',
                    color: resolutions[file] === 'external'
                      ? 'var(--color-selection-blue, #0a84ff)'
                      : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  使用外部版本
                </button>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            padding: '0 18px 18px',
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--color-border-subtle)',
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--color-selection-blue, #0a84ff)',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            确认保存
          </button>
        </div>
      </div>
    </div>
  );
}
