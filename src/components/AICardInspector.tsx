import { useEffect, useState } from 'react';
import { getAICardOverlayPosition } from '../lib/ai-card-layout';
import type { AICard, AICardType } from '../types/ai';
import { Alert, Button, Input, NumberField, PillGroup, type PillGroupItem, Textarea } from '../ui';
import { AppIcon } from './AppIcon';
import styles from './AICardInspector.module.css';

interface AICardInspectorProps {
  card: AICard | null;
  errorMessage?: string | null;
  isRegenerating?: boolean;
  previewWidth?: number;
  previewHeight?: number;
  showCancel?: boolean;
  onCancel?: () => void;
  onDelete?: () => void;
  onRegenerate: (updates: Partial<AICard>) => Promise<AICard | null>;
  onSave: (cardId: string, updates: Partial<AICard>) => void;
}

const CARD_TYPES: Array<PillGroupItem<AICardType>> = [
  { value: 'summary', label: '摘要' },
  { value: 'data', label: '数据' },
  { value: 'insight', label: '观点' },
  { value: 'chapter', label: '章节' },
  { value: 'quote', label: '金句' },
];

const DISPLAY_MODES: Array<PillGroupItem<'fullscreen' | 'pip'>> = [
  { value: 'fullscreen' as const, label: '全屏' },
  { value: 'pip' as const, label: '画中画' },
];

export function AICardInspector({
  card,
  errorMessage = null,
  isRegenerating = false,
  previewWidth = 1_920,
  previewHeight = 1_080,
  showCancel = false,
  onCancel,
  onDelete,
  onRegenerate,
  onSave,
}: AICardInspectorProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [cardPrompt, setCardPrompt] = useState('');
  const [type, setType] = useState<AICardType>('summary');
  const [displayMode, setDisplayMode] = useState<'fullscreen' | 'pip'>('fullscreen');
  const [displayDurationMs, setDisplayDurationMs] = useState(5_000);

  useEffect(() => {
    if (!card) {
      return;
    }

    setTitle(card.title);
    setContent(
      typeof card.content === 'string' ? card.content : JSON.stringify(card.content, null, 2),
    );
    setCardPrompt(card.cardPrompt ?? '');
    setType(card.type);
    setDisplayMode(card.displayMode);
    setDisplayDurationMs(card.displayDurationMs);
  }, [card]);

  if (!card) {
    return null;
  }

  const parsedContent =
    type === 'data'
      ? (() => {
          try {
            return JSON.parse(content);
          } catch {
            return card.content;
          }
        })()
      : content;

  const draftUpdates: Partial<AICard> = {
    title,
    content: parsedContent,
    type,
    displayMode,
    displayDurationMs,
    cardPrompt: cardPrompt.trim() || undefined,
    template: `${type}-default`,
  };

  const motion = card.motionCard;
  const hasCompiledMotion = Boolean(motion?.compiledCode);
  const previewCardPosition = getAICardOverlayPosition(displayMode, previewWidth, previewHeight);
  const previewFrameStyle =
    displayMode === 'fullscreen'
      ? undefined
      : {
          left: `${(previewCardPosition.x / Math.max(1, previewWidth)) * 100}%`,
          top: `${(previewCardPosition.y / Math.max(1, previewHeight)) * 100}%`,
          width: `${(previewCardPosition.width / Math.max(1, previewWidth)) * 100}%`,
        };

  const handleRegenerateClick = async () => {
    await onRegenerate(draftUpdates);
  };

  return (
    <div className={styles.root}>
      {errorMessage ? <Alert variant="error" description={errorMessage} /> : null}

      <div className={styles.section} data-ai-card-section="text-content">
        <span className={styles.sectionTitle}>文字内容</span>

        <PillGroup
          items={CARD_TYPES}
          value={type}
          onChange={setType}
          size="sm"
          className={styles.pillRow}
          itemClassName={styles.pillItem}
        />

        <label className={styles.fieldStack}>
          <span className={styles.fieldLabel}>标题</span>
          <Input
            size="sm"
            value={title}
            className={styles.textInput}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <label className={styles.fieldStack}>
          <span className={styles.fieldLabel}>内容</span>
          <Textarea
            size="sm"
            value={content}
            rows={5}
            resize="none"
            className={styles.textArea}
            onChange={(event) => setContent(event.target.value)}
          />
        </label>

        <label className={styles.fieldStack}>
          <span className={styles.fieldLabel}>追加提示词</span>
          <Textarea
            size="sm"
            value={cardPrompt}
            rows={3}
            resize="none"
            className={styles.promptArea}
            placeholder="输入额外的生成指导…"
            onChange={(event) => setCardPrompt(event.target.value)}
          />
        </label>
      </div>

      <div className={styles.section} data-ai-card-section="display-settings">
        <span className={styles.sectionTitle}>展示设置</span>

        <PillGroup
          items={DISPLAY_MODES}
          value={displayMode}
          onChange={setDisplayMode}
          size="sm"
          fullWidth
          className={styles.pillRow}
          itemClassName={styles.pillItem}
        />

        <div className={styles.inlineFieldRow}>
          <span className={styles.fieldLabel}>时长</span>
          <span className={styles.inlineSpacer} />
          <NumberField
            value={displayDurationMs / 1_000}
            min={1}
            step={0.5}
            unit="秒"
            className={styles.durationField}
            onChange={(value) => setDisplayDurationMs(value * 1_000)}
          />
        </div>
      </div>

      <div className={styles.section} data-ai-card-section="preview">
        <span className={styles.sectionTitle}>Motion 卡片状态</span>

        <div className={styles.previewFrameShell} data-ai-card-preview-frame="true">
          <div
            className={styles.previewStage}
            style={{ aspectRatio: `${Math.max(1, previewWidth)} / ${Math.max(1, previewHeight)}` }}
          >
            <div className={styles.previewCanvas} />
            <div
              className={[
                styles.previewFrame,
                displayMode === 'fullscreen'
                  ? styles.previewFrameFullscreen
                  : styles.previewFramePip,
              ].join(' ')}
              style={previewFrameStyle}
            >
              <div className={styles.previewPlaceholder}>
                <AppIcon name="eye" size={20} className={styles.previewIcon} />
                <span className={styles.previewHint}>
                  {hasCompiledMotion ? 'Motion 卡片已就绪' : '尚未生成 Motion 代码'}
                </span>
                <span className={styles.previewBadge}>
                  {displayMode === 'fullscreen' ? '全屏模式' : '画中画模式'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          {showCancel && onCancel ? (
            <Button variant="secondary" size="sm" className={styles.actionBtn} onClick={onCancel}>
              取消
            </Button>
          ) : null}

          <Button
            variant="secondary"
            size="sm"
            className={styles.actionBtn}
            leftIcon={
              <AppIcon
                name="refresh-cw"
                size={12}
                className={isRegenerating ? styles.spin : undefined}
              />
            }
            onClick={() => {
              void handleRegenerateClick();
            }}
            disabled={isRegenerating}
          >
            {isRegenerating ? '重生成中...' : '重新生成'}
          </Button>

          <Button
            variant="primary"
            size="sm"
            className={styles.actionBtn}
            leftIcon={<AppIcon name="save" size={12} />}
            onClick={() => {
              onSave(card.id, draftUpdates);
            }}
          >
            保存
          </Button>
        </div>
      </div>

      <div className={styles.section} data-ai-card-section="danger">
        <span className={styles.dangerTitle}>危险操作</span>
        <Button
          variant="destructive"
          size="sm"
          fullWidth
          leftIcon={<AppIcon name="trash-2" size={13} />}
          onClick={() => onDelete?.()}
        >
          删除此卡片
        </Button>
      </div>
    </div>
  );
}
