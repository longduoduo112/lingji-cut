import { Save } from 'lucide-react';

interface OperationBarProps {
  originalStats: { charCount: number; lineCount: number };
  scriptStats: { charCount: number; lineCount: number; estimatedDuration: string };
  annotationSummary: { total: number; pending: number; accepted: number; dismissed: number };
  onBack: () => void;
  onSave: () => void;
}

function renderSummary({
  originalStats,
  scriptStats,
  annotationSummary,
}: Pick<OperationBarProps, 'originalStats' | 'scriptStats' | 'annotationSummary'>) {
  const parts: string[] = [];

  if (originalStats.charCount > 0) {
    parts.push(`原稿 ${originalStats.charCount.toLocaleString()} 字 · ${originalStats.lineCount} 行`);
  }

  if (scriptStats.charCount > 0) {
    parts.push(`口播稿 ${scriptStats.charCount.toLocaleString()} 字 · 约 ${scriptStats.estimatedDuration}`);
  }

  if (annotationSummary.total > 0) {
    parts.push(`批注 ${annotationSummary.total} 条 · 待处理 ${annotationSummary.pending}`);
  }

  return parts.length > 0 ? parts.join('  |  ') : '请选择工作目录并导入原稿';
}

export function OperationBar({
  originalStats,
  scriptStats,
  annotationSummary,
  onBack,
  onSave,
}: OperationBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '10px 18px',
        borderBottom: '1px solid var(--color-border-subtle)',
        background: 'var(--color-panel-bg)',
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', flex: 1, minWidth: 0 }}>
        {renderSummary({ originalStats, scriptStats, annotationSummary })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onSave}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 10px',
            borderRadius: 8,
            border: '1px solid var(--color-border-subtle)',
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
          }}
        >
          <Save size={14} />
          保存
        </button>

        <button
          type="button"
          onClick={onBack}
          style={{
            padding: '7px 10px',
            borderRadius: 8,
            border: '1px solid var(--color-border-subtle)',
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
          }}
        >
          返回
        </button>
      </div>
    </div>
  );
}
