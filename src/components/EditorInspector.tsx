import { EmptyState, IconButton, SurfaceCard } from '../ui/primitives';
import { Badge } from '../ui/primitives/Badge';
import { PanelHeader } from '../ui/patterns';
import { AppIcon } from './AppIcon';
import { AICardInspector } from './AICardInspector';
import { SubtitleInspector } from './SubtitleInspector';
import { useAICardInspector } from '../hooks/useAICardInspector';
import styles from './EditorInspector.module.css';

export type InspectorSelection =
  | { type: 'empty' }
  | { type: 'ai-card'; cardId: string }
  | { type: 'subtitle-style' };

interface EditorInspectorProps {
  selection: InspectorSelection;
  timelineWidth: number;
  timelineHeight: number;
  onClose: () => void;
}

export function EditorInspector({
  selection,
  timelineHeight,
  timelineWidth,
  onClose,
}: EditorInspectorProps) {
  const {
    card,
    errorMessage,
    isPlacedOnTimeline,
    isRegeneratingCard,
    regenerateCard,
    saveCard,
  } = useAICardInspector(selection.type === 'ai-card' ? selection.cardId : null);

  const renderBody = () => {
    if (selection.type === 'subtitle-style') {
      return <SubtitleInspector />;
    }

    if (selection.type === 'ai-card') {
      if (!card) {
        return (
          <div className={styles.emptyWrap}>
            <EmptyState
              title="卡片不存在"
              description="当前 AI 卡片可能已被删除，请重新从左侧卡片列表或时间轴中选择。"
            />
          </div>
        );
      }

      return (
        <AICardInspector
          card={card}
          errorMessage={errorMessage}
          isRegenerating={isRegeneratingCard}
          previewWidth={timelineWidth}
          previewHeight={timelineHeight}
          onRegenerate={regenerateCard}
          onSave={saveCard}
        />
      );
    }

    return (
      <div className={styles.emptyWrap}>
        <EmptyState
          title="右侧配置区"
          description="从左侧 AI 内容卡片或底部时间轴中选择一个对象后，这里会显示对应的配置表单。"
        />
      </div>
    );
  };

  return (
    <SurfaceCard
      variant="elevated"
      padding="none"
      className={styles.shell}
      data-editor-region="inspector-shell"
    >
      <div className={styles.header}>
        <PanelHeader
          eyebrow="INSPECTOR"
          title={
            selection.type === 'subtitle-style'
              ? '字幕高亮设置'
              : selection.type === 'ai-card'
              ? 'AI 卡片设置'
              : '配置区'
          }
          description={
            selection.type === 'ai-card' ? (
              <span className={styles.statusLine}>编辑卡片文案、版式和网页卡片预览。</span>
            ) : selection.type === 'subtitle-style' ? (
              <span className={styles.statusLine}>集中调整关键词高亮生成与字幕样式。</span>
            ) : (
              <span className={styles.statusLine}>统一承接素材与字幕配置，减少弹窗式编辑。</span>
            )
          }
          meta={
            selection.type === 'ai-card' && card ? (
              <Badge variant={isPlacedOnTimeline ? 'info' : 'neutral'}>
                {isPlacedOnTimeline ? '已上轨' : '仅素材'}
              </Badge>
            ) : null
          }
          actions={
            selection.type === 'empty' ? null : (
              <IconButton
                aria-label="关闭右侧配置区"
                title="关闭右侧配置区"
                onClick={onClose}
                variant="ghost"
                size="sm"
              >
                ×
              </IconButton>
            )
          }
        />
      </div>
      <div className={styles.body}>{renderBody()}</div>
    </SurfaceCard>
  );
}
