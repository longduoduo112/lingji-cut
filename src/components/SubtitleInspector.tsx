import { useCallback, useMemo, useState } from 'react';
import { getAISettingsIssue } from '../lib/ai-settings';
import { generateSubtitleHighlights } from '../lib/subtitle-highlight-runner';
import { filterValidSubtitleHighlights } from '../lib/subtitle-highlights';
import { clamp, getFileNameFromPath } from '../lib/utils';
import type { SubtitleStyle } from '../types';
import { loadAISettings } from '../store/ai';
import { useTimelineStore } from '../store/timeline';
import { Button } from '../ui/primitives';
import styles from './SubtitleInspector.module.css';

export function SubtitleInspector() {
  const [isGeneratingHighlights, setIsGeneratingHighlights] = useState(false);
  const [subtitleHighlightError, setSubtitleHighlightError] = useState<string | null>(null);
  const { srtEntries, setSubtitleHighlights, timeline, updateSubtitleStyle } = useTimelineStore();
  const validSubtitleHighlights = useMemo(
    () => filterValidSubtitleHighlights(srtEntries, timeline.subtitleHighlights ?? []),
    [srtEntries, timeline.subtitleHighlights],
  );
  const storedSubtitleHighlightCount = timeline.subtitleHighlights?.length ?? 0;
  const expiredSubtitleHighlightCount = Math.max(
    0,
    storedSubtitleHighlightCount - validSubtitleHighlights.length,
  );
  const summaryText = useMemo(() => {
    if (!timeline.podcast.srtPath) {
      return '还没有导入 SRT 字幕文件，导入后就可以生成关键词高亮并在这里调整样式。';
    }

    if (subtitleHighlightError) {
      return subtitleHighlightError;
    }

    if (isGeneratingHighlights) {
      return 'AI 正在分析字幕关键词，生成完成后会自动更新底部字幕轨和右侧预览。';
    }

    if (storedSubtitleHighlightCount === 0) {
      return '当前还没有生成关键词高亮，建议先生成一版，再细调颜色、圆角与动画。';
    }

    if (expiredSubtitleHighlightCount > 0) {
      return validSubtitleHighlights.length > 0
        ? `当前有 ${validSubtitleHighlights.length} 处有效高亮，另有 ${expiredSubtitleHighlightCount} 处因字幕变化已过期。`
        : '已有高亮结果全部过期，建议重新生成。';
    }

    return `当前已有 ${validSubtitleHighlights.length} 处关键词高亮，可继续微调样式。`;
  }, [
    expiredSubtitleHighlightCount,
    isGeneratingHighlights,
    storedSubtitleHighlightCount,
    subtitleHighlightError,
    timeline.podcast.srtPath,
    validSubtitleHighlights.length,
  ]);

  const handleGenerateSubtitleHighlights = useCallback(async () => {
    const settings = loadAISettings();
    const settingsIssue = getAISettingsIssue(settings);
    if (settingsIssue) {
      setSubtitleHighlightError(settingsIssue);
      return;
    }

    if (srtEntries.length === 0) {
      setSubtitleHighlightError('请先导入 SRT 字幕文件');
      return;
    }

    setIsGeneratingHighlights(true);
    setSubtitleHighlightError(null);

    try {
      const highlights = await generateSubtitleHighlights(srtEntries, settings);
      setSubtitleHighlights(highlights);
      updateSubtitleStyle({ highlightEnabled: true });
    } catch (error) {
      setSubtitleHighlightError(
        error instanceof Error ? error.message : '字幕关键词高亮生成失败',
      );
    } finally {
      setIsGeneratingHighlights(false);
    }
  }, [setSubtitleHighlights, srtEntries, updateSubtitleStyle]);

  const handleSubtitleStyleUpdate = useCallback(
    (updates: Partial<SubtitleStyle>) => {
      setSubtitleHighlightError(null);
      updateSubtitleStyle(updates);
    },
    [updateSubtitleStyle],
  );

  return (
    <div className={styles.root}>
      <div className={styles.summaryCard}>
        <div className={styles.summaryTitle}>关键词高亮样式</div>
        <div className={styles.summaryMeta}>
          {timeline.podcast.srtPath
            ? getFileNameFromPath(timeline.podcast.srtPath)
            : '等待导入字幕'}
        </div>
        <div className={styles.summaryText}>{summaryText}</div>
      </div>

      {subtitleHighlightError ? <div className={styles.error}>{subtitleHighlightError}</div> : null}

      <div className={styles.actionRow}>
        <Button
          onClick={() => void handleGenerateSubtitleHighlights()}
          loading={isGeneratingHighlights}
          disabled={!timeline.podcast.srtPath}
          variant="primary"
        >
          {storedSubtitleHighlightCount > 0 ? '重新生成高亮' : '生成高亮'}
        </Button>
      </div>

      <label className={styles.switchRow}>
        <span>启用关键词高亮</span>
        <input
          checked={timeline.subtitle.highlightEnabled}
          onChange={(event) =>
            handleSubtitleStyleUpdate({
              highlightEnabled: event.currentTarget.checked,
            })
          }
          type="checkbox"
        />
      </label>

      <div className={styles.grid}>
        <label className={styles.field}>
          <span>高亮底色</span>
          <input
            type="color"
            value={timeline.subtitle.highlightBackgroundColor}
            onChange={(event) =>
              handleSubtitleStyleUpdate({
                highlightBackgroundColor: event.currentTarget.value,
              })
            }
          />
        </label>
        <label className={styles.field}>
          <span>文字颜色</span>
          <input
            type="color"
            value={timeline.subtitle.highlightTextColor}
            onChange={(event) =>
              handleSubtitleStyleUpdate({
                highlightTextColor: event.currentTarget.value,
              })
            }
          />
        </label>
        <label className={styles.field}>
          <span>圆角</span>
          <input
            type="number"
            min={0}
            max={24}
            value={timeline.subtitle.highlightRadius}
            onChange={(event) =>
              handleSubtitleStyleUpdate({
                highlightRadius: clamp(Number(event.currentTarget.value), 0, 24),
              })
            }
          />
        </label>
        <label className={styles.field}>
          <span>横向留白</span>
          <input
            type="number"
            min={0}
            max={24}
            value={timeline.subtitle.highlightPaddingX}
            onChange={(event) =>
              handleSubtitleStyleUpdate({
                highlightPaddingX: clamp(Number(event.currentTarget.value), 0, 24),
              })
            }
          />
        </label>
        <label className={styles.field}>
          <span>纵向留白</span>
          <input
            type="number"
            min={0}
            max={16}
            value={timeline.subtitle.highlightPaddingY}
            onChange={(event) =>
              handleSubtitleStyleUpdate({
                highlightPaddingY: clamp(Number(event.currentTarget.value), 0, 16),
              })
            }
          />
        </label>
        <label className={styles.field}>
          <span>高亮动画</span>
          <select
            value={timeline.subtitle.highlightAnimation}
            onChange={(event) =>
              handleSubtitleStyleUpdate({
                highlightAnimation: event.currentTarget.value as SubtitleStyle['highlightAnimation'],
              })
            }
          >
            <option value="pop">弹入</option>
            <option value="wipe">擦入</option>
            <option value="none">无动画</option>
          </select>
        </label>
      </div>

      <div className={styles.preview}>
        <span className={styles.previewPrefix}>这一句真正的重点是</span>
        <span
          className={styles.previewChip}
          style={{
            background: timeline.subtitle.highlightBackgroundColor,
            color: timeline.subtitle.highlightTextColor,
            borderRadius: timeline.subtitle.highlightRadius,
            padding: `${timeline.subtitle.highlightPaddingY}px ${timeline.subtitle.highlightPaddingX}px`,
          }}
        >
          世界冠军
        </span>
      </div>
    </div>
  );
}
