import React, { useEffect, useMemo, useState } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { Player } from '@remotion/player';
import type { AICardDisplayMode } from '../types/ai';
import type { MotionCardPayload, MotionComponentProps } from '../types/motion';
import { createMotionComponent } from '../lib/motion-runtime';
import { Button, Input, NumberField, PillGroup, type PillGroupItem, Textarea } from '../ui';
import { AppIcon } from './AppIcon';
import styles from './MotionCardInspector.module.css';

export interface MotionCardEdits {
  title: string;
  durationMs: number;
  displayMode: AICardDisplayMode;
}

export interface MotionCardInspectorProps {
  cardId: string;
  title?: string;
  prompt?: string;
  durationMs?: number;
  displayMode?: AICardDisplayMode;
  motionCard?: MotionCardPayload | null;
  isModifying?: boolean;
  errorMessage?: string | null;
  onModify: (instruction: string, updates: MotionCardEdits) => Promise<void>;
  onSave: (updates: MotionCardEdits) => void;
  onDelete: () => void;
}

const DISPLAY_MODES: Array<PillGroupItem<AICardDisplayMode>> = [
  { value: 'fullscreen', label: '全屏' },
  { value: 'pip', label: '画中画' },
];

const PREVIEW_FPS = 30;
const PREVIEW_WIDTH = 1920;
const PREVIEW_HEIGHT = 1080;

/** 从 compiledCode 构建可直接传给 Remotion Player 的包装组件。 */
function buildPlayerWrapper(
  compiledCode: string,
): { component: React.ComponentType; error: null } | { component: null; error: string } {
  try {
    const MotionComp = createMotionComponent(compiledCode);
    function MotionPreviewWrapper() {
      const frame = useCurrentFrame();
      const { fps, durationInFrames, width, height } = useVideoConfig();
      return React.createElement(MotionComp, { frame, fps, durationInFrames, width, height } as MotionComponentProps);
    }
    return { component: MotionPreviewWrapper, error: null };
  } catch (error) {
    return { component: null, error: error instanceof Error ? error.message : '预览组件创建失败' };
  }
}

export function MotionCardInspector({
  cardId: _cardId,
  title: titleProp = '',
  prompt: promptProp = '',
  durationMs: durationMsProp = 5_000,
  displayMode: displayModeProp = 'fullscreen',
  motionCard,
  isModifying = false,
  errorMessage = null,
  onModify,
  onSave,
  onDelete,
}: MotionCardInspectorProps) {
  const [title, setTitle] = useState(titleProp);
  const [instruction, setInstruction] = useState('');
  const [durationMs, setDurationMs] = useState(durationMsProp);
  const [displayMode, setDisplayMode] = useState<AICardDisplayMode>(displayModeProp);

  // 当外部 props 切换（换了一张卡片）时重置本地状态
  useEffect(() => {
    setTitle(titleProp);
    setDurationMs(durationMsProp);
    setDisplayMode(displayModeProp);
    setInstruction('');
  }, [titleProp, durationMsProp, displayModeProp]);

  const compiledCode = motionCard?.compiledCode ?? '';
  const hasCode = Boolean(compiledCode);
  const hasError = Boolean(motionCard?.compileError);

  const playerWrapper = useMemo(() => {
    if (!compiledCode) return null;
    return buildPlayerWrapper(compiledCode);
  }, [compiledCode]);

  const durationInFrames = Math.max(1, Math.round((durationMs / 1000) * PREVIEW_FPS));

  const currentEdits: MotionCardEdits = { title, durationMs, displayMode };

  const handleModifyClick = async () => {
    await onModify(instruction, currentEdits);
    setInstruction('');
  };

  return (
    <div className={styles.root}>
      {errorMessage ? <span className={styles.errorText}>{errorMessage}</span> : null}

      {/* ─── 编辑内容 ─── */}
      <div className={styles.section} data-motion-section="edit">
        <span className={styles.sectionTitle}>编辑内容</span>

        <label className={styles.fieldStack}>
          <span className={styles.fieldLabel}>标题</span>
          <Input
            size="sm"
            value={title}
            className={styles.textInput}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        {promptProp ? (
          <div className={styles.fieldStack}>
            <span className={styles.fieldLabel}>原始提示词</span>
            <p className={styles.promptPreview}>{promptProp}</p>
          </div>
        ) : null}

        <label className={styles.fieldStack}>
          <span className={styles.fieldLabel}>修改说明</span>
          <Textarea
            size="sm"
            value={instruction}
            rows={3}
            resize="none"
            className={styles.textArea}
            placeholder={hasCode ? '描述你想改变的内容，留空则基于原提示词重新生成…' : '描述想要的动画效果…'}
            onChange={(event) => setInstruction(event.target.value)}
          />
        </label>

        <div className={styles.inlineFieldRow}>
          <span className={styles.fieldLabel}>时长</span>
          <span className={styles.inlineSpacer} />
          <NumberField
            value={durationMs / 1_000}
            min={1}
            step={0.5}
            unit="秒"
            className={styles.durationField}
            onChange={(value) => setDurationMs(value * 1_000)}
          />
        </div>

        <div className={styles.fieldStack}>
          <span className={styles.fieldLabel}>显示模式</span>
          <PillGroup
            items={DISPLAY_MODES}
            value={displayMode}
            onChange={setDisplayMode}
            size="sm"
            fullWidth
            className={styles.pillRow}
            itemClassName={styles.pillItem}
          />
        </div>
      </div>

      {/* ─── 动画预览 ─── */}
      <div className={styles.section} data-motion-section="preview">
        <span className={styles.sectionTitle}>动画预览</span>

        <div className={styles.previewShell}>
          {isModifying ? (
            <div className={styles.previewPlaceholder}>
              <span className={styles.previewIcon}>
                <AppIcon name="refresh-cw" size={18} className={styles.spinIcon} />
              </span>
              <span className={styles.previewHint}>正在重新生成动画…</span>
            </div>
          ) : playerWrapper?.component ? (
            <Player
              component={playerWrapper.component}
              durationInFrames={durationInFrames}
              fps={PREVIEW_FPS}
              compositionWidth={PREVIEW_WIDTH}
              compositionHeight={PREVIEW_HEIGHT}
              style={{ width: '100%' }}
              controls
              loop
            />
          ) : hasError ? (
            <div className={styles.previewError}>
              <AppIcon name="alert-circle" size={16} className={styles.previewErrorIcon} />
              <span>{motionCard?.compileError ?? '动画编译失败'}</span>
            </div>
          ) : (
            <div className={styles.previewPlaceholder}>
              <span className={styles.previewIcon}>
                <AppIcon name="film" size={18} />
              </span>
              <span className={styles.previewHint}>
                {!hasCode ? '动画生成后将在此显示预览' : '暂无预览'}
              </span>
            </div>
          )}

          {playerWrapper?.error && !isModifying ? (
            <div className={styles.previewError}>
              <span>{playerWrapper.error}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* ─── 操作按钮 ─── */}
      <div className={styles.section} data-motion-section="actions">
        <div className={styles.actions}>
          <Button
            variant="secondary"
            size="sm"
            className={styles.secondaryAction}
            leftIcon={
              <AppIcon
                name="refresh-cw"
                size={12}
                className={isModifying ? styles.spinIcon : undefined}
              />
            }
            onClick={() => void handleModifyClick()}
            disabled={isModifying}
          >
            {isModifying ? '生成中...' : '重新生成'}
          </Button>

          <Button
            variant="primary"
            size="sm"
            className={styles.primaryAction}
            leftIcon={<AppIcon name="save" size={12} />}
            onClick={() => onSave(currentEdits)}
            disabled={isModifying}
          >
            仅保存
          </Button>
        </div>
      </div>

      {/* ─── 危险操作 ─── */}
      <div className={styles.section} data-motion-section="danger">
        <span className={styles.dangerTitle}>危险操作</span>
        <Button
          variant="destructive"
          size="sm"
          className={styles.dangerButton}
          leftIcon={<AppIcon name="trash-2" size={13} />}
          onClick={() => onDelete()}
        >
          删除动画
        </Button>
      </div>
    </div>
  );
}
