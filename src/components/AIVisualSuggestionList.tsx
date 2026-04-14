import { Alert, Badge, Button, Spinner } from '../ui';
import type { AIStoryboardPlan } from '../types/ai';
import styles from './AIVisualSuggestionList.module.css';

interface AIVisualSuggestionListProps {
  storyboardPlan: AIStoryboardPlan | null;
  isAnalyzing?: boolean;
  error?: string | null;
  onAnalyze?: () => void;
}

function getSuggestionLabel(type: string): string {
  switch (type) {
    case 'data-motion':
      return '数据动画';
    case 'explainer-motion':
      return '解释动画';
    case 'chapter-transition':
      return '章节切场';
    default:
      return '内容卡片';
  }
}

export function AIVisualSuggestionList({
  storyboardPlan,
  isAnalyzing = false,
  error = null,
  onAnalyze,
}: AIVisualSuggestionListProps) {
  const suggestions = storyboardPlan?.suggestions ?? [];
  const analyzeButtonLabel = isAnalyzing
    ? '分析中...'
    : storyboardPlan
      ? '重新分析视觉编排'
      : '分析视觉编排';

  return (
    <section className={styles.root} aria-label="视觉编排建议">
      <div className={styles.header}>
        <span className={styles.title}>视觉编排建议</span>
        <Button
          variant={storyboardPlan ? 'secondary' : 'primary'}
          size="sm"
          onClick={onAnalyze}
          disabled={!onAnalyze || isAnalyzing}
        >
          {isAnalyzing ? (
            <>
              <Spinner size={12} color="#FFFFFF" />
              {analyzeButtonLabel}
            </>
          ) : (
            analyzeButtonLabel
          )}
        </Button>
      </div>

      <div className={styles.hint}>
        分析完成后会根据字幕自动生成对应的动画卡片，生成完成后可在下方选择并点击"上轨"应用到时间轴。
      </div>

      {error ? <Alert variant="destructive">{error}</Alert> : null}

      {suggestions.length > 0 ? (
        <div className={styles.list}>
          {suggestions.map((suggestion) => (
            <article key={suggestion.id} className={styles.item}>
              <div className={styles.itemHead}>
                <span className={styles.itemTitle}>{getSuggestionLabel(suggestion.suggestionType)}</span>
                <div className={styles.meta}>
                  <Badge variant="secondary" size="xs">
                    {suggestion.templateKey}
                  </Badge>
                  <Badge variant="glass" size="xs">
                    {Math.round(suggestion.displayDurationMs / 100) / 10}s
                  </Badge>
                </div>
              </div>
              <div className={styles.reason}>{suggestion.reason}</div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          还没有视觉建议。点击"分析视觉编排"，系统会基于字幕判断哪些段落适合做数据动画、解释动画或章节切场，并自动生成对应的动画卡片。
        </div>
      )}
    </section>
  );
}
