import { Check, X } from 'lucide-react';
import type { Annotation } from '../../store/script';
import styles from './AnnotationList.module.css';

function AnnotationCard({
  annotation,
  index,
  onAccept,
  onDismiss,
}: {
  annotation: Annotation;
  index: number;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const accepted = annotation.status === 'accepted';
  const dismissed = annotation.status === 'dismissed';
  const pending = annotation.status === 'pending';
  const hasSuggestion =
    annotation.suggestion && annotation.suggestion !== annotation.originalText;

  const cardClass = [
    styles.card,
    !pending ? styles.cardResolved : '',
  ].filter(Boolean).join(' ');

  const stripeClass = [
    styles.severityStripe,
    accepted ? styles.severityStripeAccepted : '',
    dismissed ? styles.severityStripeDismissed : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClass}>
      <div
        className={stripeClass}
        data-severity={annotation.severity}
      />
      <div className={styles.cardBody}>
        {/* 元信息行 */}
        <div className={styles.cardMeta}>
          <span className={styles.cardIndex}>#{index + 1}</span>
          <span
            className={`${styles.statusTag} ${
              accepted
                ? styles.statusAccepted
                : dismissed
                  ? styles.statusDismissed
                  : styles.statusPending
            }`}
          >
            {accepted ? '已采纳' : dismissed ? '已忽略' : '待处理'}
          </span>
        </div>

        {/* 问题描述 */}
        <div className={styles.issueText}>{annotation.issue}</div>

        {/* 原文引用 */}
        <div className={styles.quoteBlock}>
          <div className={styles.quoteBorder} />
          <div className={styles.quoteText}>{annotation.originalText}</div>
        </div>

        {/* 修改建议 */}
        {hasSuggestion && (
          <div className={styles.suggestion}>
            <div className={styles.suggestionBorder} />
            <div className={styles.suggestionText}>{annotation.suggestion}</div>
          </div>
        )}

        {/* 操作按钮 */}
        {pending && (
          <div className={styles.cardActions}>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.btnDismiss}`}
              onClick={onDismiss}
            >
              <X size={11} strokeWidth={2} />
              忽略
            </button>
            {hasSuggestion && (
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.btnAccept}`}
                onClick={onAccept}
              >
                <Check size={11} strokeWidth={2.5} />
                采纳
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function AnnotationList({
  annotations,
  onAccept,
  onDismiss,
}: {
  annotations: Annotation[];
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  if (!annotations.length) {
    return (
      <div className={styles.empty}>
        暂无批注
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {annotations.map((annotation, index) => (
        <AnnotationCard
          key={annotation.id}
          annotation={annotation}
          index={index}
          onAccept={() => onAccept(annotation.id)}
          onDismiss={() => onDismiss(annotation.id)}
        />
      ))}
    </div>
  );
}
