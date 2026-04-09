import { Check, X } from 'lucide-react';
import type { Annotation } from '../../store/script';
import styles from './ReviewStatusBar.module.css';

interface ReviewStatusBarProps {
  annotations: Annotation[];
  onAcceptAll: () => void;
  onDismissAll: () => void;
}

export function ReviewStatusBar({
  annotations,
  onAcceptAll,
  onDismissAll,
}: ReviewStatusBarProps) {
  const pending = annotations.filter((a) => a.status === 'pending').length;
  const accepted = annotations.filter((a) => a.status === 'accepted').length;
  const dismissed = annotations.filter((a) => a.status === 'dismissed').length;
  const total = annotations.length;

  if (total === 0) return null;

  const allResolved = pending === 0;

  return (
    <div className={styles.bar}>
      <div className={styles.stats}>
        {pending > 0 && (
          <span className={`${styles.badge} ${styles.badgePending}`}>
            {pending} 待处理
          </span>
        )}
        {accepted > 0 && (
          <span className={`${styles.badge} ${styles.badgeAccepted}`}>
            {accepted} 采纳
          </span>
        )}
        {dismissed > 0 && (
          <span className={`${styles.badge} ${styles.badgeDismissed}`}>
            {dismissed} 忽略
          </span>
        )}
        <span className={styles.sep}>/</span>
        <span className={styles.total}>{total} 条批注</span>
      </div>

      {!allResolved ? (
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.btnDismiss}`}
            onClick={onDismissAll}
            title="忽略所有待处理批注"
          >
            <X size={10} strokeWidth={2} />
            全部忽略
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.btnAccept}`}
            onClick={onAcceptAll}
            title="采纳所有待处理批注"
          >
            <Check size={10} strokeWidth={2.5} />
            全部采纳
          </button>
        </div>
      ) : (
        <span className={styles.resolvedHint}>已全部处理</span>
      )}
    </div>
  );
}
