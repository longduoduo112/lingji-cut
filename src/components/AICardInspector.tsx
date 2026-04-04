import { useEffect, useState } from 'react';
import { getAICardOverlayPosition } from '../lib/ai-card-layout';
import type { AICard, AICardType } from '../types/ai';
import { Button, Field, Input, Textarea } from '../ui/primitives';
import { PillGroup } from '../ui/patterns';
import { WebCardPreview } from './WebCardPreview';
import styles from './AICardInspector.module.css';

interface AICardInspectorProps {
  card: AICard | null;
  errorMessage?: string | null;
  isRegenerating?: boolean;
  previewWidth?: number;
  previewHeight?: number;
  showCancel?: boolean;
  onCancel?: () => void;
  onRegenerate: (updates: Partial<AICard>) => Promise<AICard | null>;
  onSave: (cardId: string, updates: Partial<AICard>) => void;
}

const CARD_TYPES: Array<{ value: AICardType; label: string }> = [
  { value: 'summary', label: '摘要' },
  { value: 'data', label: '数据' },
  { value: 'insight', label: '观点' },
  { value: 'chapter', label: '章节' },
  { value: 'quote', label: '金句' },
];

const DISPLAY_MODES = [
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
  onRegenerate,
  onSave,
}: AICardInspectorProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [cardPrompt, setCardPrompt] = useState('');
  const [type, setType] = useState<AICardType>('summary');
  const [displayMode, setDisplayMode] = useState<'fullscreen' | 'pip'>('fullscreen');
  const [displayDurationMs, setDisplayDurationMs] = useState(5_000);
  const [previewWebCard, setPreviewWebCard] = useState<AICard['webCard']>();

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
    setPreviewWebCard(card.webCard);
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
    if (previewWebCard) {
      setPreviewWebCard({
        ...previewWebCard,
        runtimeStatus: 'loading',
      });
    }

    const regeneratedCard = await onRegenerate(draftUpdates);
    if (regeneratedCard?.webCard) {
      setPreviewWebCard(regeneratedCard.webCard);
      return;
    }

    setPreviewWebCard(card.webCard);
  };

  return (
    <div className={styles.root}>
      {errorMessage ? <div className={styles.error}>{errorMessage}</div> : null}

      <div className={styles.form}>
        <Field label="卡片类型">
          <PillGroup items={CARD_TYPES} value={type} onChange={setType} />
        </Field>

        <Field label="标题">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>

        <Field label="内容">
          <Textarea value={content} onChange={(event) => setContent(event.target.value)} rows={5} />
        </Field>

        <Field label="单卡追加提示词">
          <Textarea
            value={cardPrompt}
            onChange={(event) => setCardPrompt(event.target.value)}
            rows={3}
            placeholder="例如：做成更有冲击力的封面海报感，结论更前置"
          />
        </Field>

        <Field label="网页卡片预览">
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
              <WebCardPreview
                webCard={previewWebCard ?? card.webCard}
                stageWidth={previewWidth}
                stageHeight={previewHeight}
                isLoading={isRegenerating}
                loadingLabel="正在重生成网页卡片..."
              />
            </div>
            <span className={styles.previewModeBadge}>
              {displayMode === 'fullscreen' ? '全屏位置预览' : '画中画位置预览'}
            </span>
          </div>
        </Field>

        <div className={styles.twoColumn}>
          <Field label="展示时长（秒）">
            <Input
              type="number"
              min={1}
              max={30}
              value={displayDurationMs / 1_000}
              onChange={(event) =>
                setDisplayDurationMs(Math.max(1, Number(event.target.value) || 1) * 1_000)
              }
            />
          </Field>

          <Field label="展示方式">
            <PillGroup
              items={DISPLAY_MODES}
              value={displayMode}
              onChange={setDisplayMode}
              fullWidth
            />
          </Field>
        </div>

        <div className={styles.actions}>
          {showCancel && onCancel ? (
            <Button variant="secondary" onClick={onCancel}>
              取消
            </Button>
          ) : null}
          <Button
            variant="secondary"
            onClick={() => {
              void handleRegenerateClick();
            }}
            disabled={isRegenerating}
            loading={isRegenerating}
          >
            {isRegenerating ? '重生成中...' : '重新生成此卡'}
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              onSave(card.id, draftUpdates);
            }}
          >
            保存
          </Button>
        </div>
      </div>
    </div>
  );
}
