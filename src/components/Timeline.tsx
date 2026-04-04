import type { CSSProperties, DragEvent, MouseEvent, ReactNode, WheelEvent } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { TrackDragZone } from '../lib/overlay-drag';
import { getRenderableVisualTracks, getVisualTracks } from '../lib/timeline-tracks';
import { filterValidSubtitleHighlights } from '../lib/subtitle-highlights';
import { clamp, formatTime, getFileNameFromPath } from '../lib/utils';
import {
  getAnchoredTimelineScrollLeft,
  getFitTimelineZoom,
  getNextTimelineZoom,
  getTimelineTrackWidth,
  getWheelTimelineZoom,
} from '../lib/timeline-view';
import type { TimelineTrack } from '../types';
import { useTimelineStore } from '../store/timeline';
import { OverlayBlock } from './OverlayBlock';
import { TimelineAudioWaveform } from './TimelineAudioWaveform';
import { TimelineSubtitleBlocks } from './TimelineSubtitleBlocks';
import styles from './Timeline.module.css';

interface TimelineProps {
  currentTimeMs: number;
  onSeek: (ms: number) => void;
  compact: boolean;
  onOpenAICardInspector?: (cardId: string) => void;
  onOpenSubtitleInspector?: () => void;
}

interface AssetLike {
  path: string;
  type: 'video' | 'image';
  durationMs: number;
  overlayRole?: 'default-background';
}

export function Timeline({
  currentTimeMs,
  onSeek,
  compact,
  onOpenAICardInspector,
  onOpenSubtitleInspector,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingScrollLeftRef = useRef<number | null>(null);
  const trackLaneRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [hoverTrackId, setHoverTrackId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewportWidth, setViewportWidth] = useState(0);
  const {
    addOverlay,
    addTrack,
    setGlobalBackground,
    srtEntries,
    timeline,
  } = useTimelineStore();
  const durationMs = Math.max(1000, timeline.podcast.durationMs);
  const outerPadding = compact ? 12 : 16;
  const sidebarWidth = compact ? 100 : 120;
  const toolbarHeight = compact ? 44 : 52;
  const rulerHeight = 28;
  const audioTrackHeight = compact ? 34 : 38;
  const subtitleTrackHeight = compact ? 72 : 86;
  const overlayTrackHeight = compact ? 40 : 44;
  const trackWidth = useMemo(
    () => getTimelineTrackWidth(durationMs, zoomLevel, Math.max(480, viewportWidth || 960)),
    [durationMs, viewportWidth, zoomLevel],
  );
  const pxPerMs = trackWidth / durationMs;
  const trackColumns = `${sidebarWidth}px ${trackWidth}px`;
  const visualTracks = useMemo(() => getVisualTracks(timeline.tracks), [timeline.tracks]);
  const renderableTracks = useMemo(
    () => getRenderableVisualTracks(timeline.tracks),
    [timeline.tracks],
  );
  const contentWidth = sidebarWidth + trackWidth;
  const majorTickInterval = useMemo(() => {
    if (durationMs <= 30_000) {
      return 5_000;
    }

    if (durationMs <= 120_000) {
      return 10_000;
    }

    return 30_000;
  }, [durationMs]);
  const minorTickInterval = Math.max(1_000, Math.round(majorTickInterval / 5));
  const ticks = useMemo(() => {
    const values: number[] = [];

    for (let cursor = 0; cursor <= durationMs; cursor += majorTickInterval) {
      values.push(cursor);
    }

    if (values[values.length - 1] !== durationMs) {
      values.push(durationMs);
    }

    return values;
  }, [durationMs, majorTickInterval]);
  const overlaysByTrack = useMemo(() => {
    const groups = new Map<string, typeof timeline.overlays>();

    for (const track of renderableTracks) {
      groups.set(track.id, []);
    }

    for (const overlay of timeline.overlays) {
      const group = groups.get(overlay.trackId);
      if (group) {
        group.push(overlay);
      }
    }

    return groups;
  }, [renderableTracks, timeline.overlays]);
  const validSubtitleHighlights = useMemo(
    () => filterValidSubtitleHighlights(srtEntries, timeline.subtitleHighlights ?? []),
    [srtEntries, timeline.subtitleHighlights],
  );
  const storedSubtitleHighlightCount = timeline.subtitleHighlights?.length ?? 0;
  const expiredSubtitleHighlightCount = Math.max(
    0,
    storedSubtitleHighlightCount - validSubtitleHighlights.length,
  );
  const subtitleHighlightHint = useMemo(() => {
    if (!timeline.podcast.srtPath) {
      return '';
    }

    if (expiredSubtitleHighlightCount > 0) {
      return validSubtitleHighlights.length > 0 ? '部分高亮已过期' : '高亮已过期';
    }

    if (validSubtitleHighlights.length > 0) {
      return '';
    }

    return storedSubtitleHighlightCount > 0 ? '高亮已过期' : '未生成高亮';
  }, [
    expiredSubtitleHighlightCount,
    storedSubtitleHighlightCount,
    timeline.podcast.srtPath,
    validSubtitleHighlights.length,
  ]);
  const subtitleHighlightSummary = useMemo(() => {
    if (!timeline.podcast.srtPath) {
      return '等待导入字幕';
    }

    if (storedSubtitleHighlightCount === 0) {
      return '尚未生成关键词高亮';
    }

    if (expiredSubtitleHighlightCount > 0) {
      return validSubtitleHighlights.length > 0
        ? `${validSubtitleHighlights.length} 处有效 · ${expiredSubtitleHighlightCount} 处过期`
        : '当前高亮结果已全部失效';
    }

    return `${validSubtitleHighlights.length} 处关键词高亮已就绪`;
  }, [
    expiredSubtitleHighlightCount,
    storedSubtitleHighlightCount,
    timeline.podcast.srtPath,
    validSubtitleHighlights.length,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateWidth = () => {
      setViewportWidth(container.clientWidth - outerPadding * 2 - sidebarWidth);
    };

    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);

    return () => observer.disconnect();
  }, [outerPadding, sidebarWidth]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || pendingScrollLeftRef.current === null) {
      return;
    }

    container.scrollLeft = pendingScrollLeftRef.current;
    pendingScrollLeftRef.current = null;
  }, [trackWidth]);

  const gridBackground = useMemo(() => {
    const major = Math.max(40, majorTickInterval * pxPerMs);
    const minor = Math.max(8, minorTickInterval * pxPerMs);

    return {
      backgroundImage: [
        `linear-gradient(180deg, rgba(15, 23, 42, 0.4), rgba(15, 23, 42, 0.2))`,
        `repeating-linear-gradient(to right, rgba(148, 163, 184, 0.12) 0 1px, transparent 1px ${major}px)`,
        `repeating-linear-gradient(to right, rgba(148, 163, 184, 0.06) 0 1px, transparent 1px ${minor}px)`,
      ].join(','),
      backgroundColor: '#020617',
    } satisfies CSSProperties;
  }, [majorTickInterval, minorTickInterval, pxPerMs]);

  const resolveTimelineOffset = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();

    if (!rect) {
      return null;
    }

    const offsetX =
      clientX -
      rect.left +
      (containerRef.current?.scrollLeft || 0) -
      outerPadding -
      sidebarWidth;

    return offsetX;
  };

  const handleSeekClick = (event: MouseEvent<HTMLDivElement>) => {
    const offsetX = resolveTimelineOffset(event.clientX);

    if (offsetX === null || offsetX < 0) {
      return;
    }

    onSeek(Math.max(0, Math.min(durationMs, Math.round(offsetX / pxPerMs))));
  };

  const handleWheelZoom = (event: WheelEvent<HTMLDivElement>) => {
    if (!event.metaKey) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    event.preventDefault();

    const nextZoom = getWheelTimelineZoom(zoomLevel, event.deltaY);
    if (nextZoom === zoomLevel) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const pointerX = Math.max(0, event.clientX - rect.left - sidebarWidth);
    const nextTrackWidth = getTimelineTrackWidth(
      durationMs,
      nextZoom,
      Math.max(480, viewportWidth || 960),
    );

    pendingScrollLeftRef.current = getAnchoredTimelineScrollLeft({
      scrollLeft: container.scrollLeft,
      pointerX,
      previousTrackWidth: trackWidth,
      nextTrackWidth,
    });

    setZoomLevel(nextZoom);
  };

  const placeAssetOnTrack = (trackId: string, asset: AssetLike, clientX: number) => {
    if (asset.overlayRole === 'default-background') {
      setGlobalBackground(asset.path);
      return;
    }

    const offsetX = resolveTimelineOffset(clientX);
    if (offsetX === null) {
      return;
    }

    addOverlay({
      type: asset.type,
      assetPath: asset.path,
      trackId,
      startMs: Math.max(0, Math.round(offsetX / pxPerMs)),
      durationMs: asset.durationMs,
      position: {
        x: 0,
        y: 0,
        width: timeline.width,
        height: timeline.height,
      },
    });
  };

  const handleTrackDrop =
    (trackId: string) =>
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setHoverTrackId(null);
      const raw = event.dataTransfer.getData('application/json');

      if (!raw) {
        return;
      }

      placeAssetOnTrack(trackId, JSON.parse(raw) as AssetLike, event.clientX);
    };

  const getTrackDragZones = (): TrackDragZone[] => {
    return visualTracks.flatMap((track) => {
      const trackLane = trackLaneRefs.current[track.id];
      if (!trackLane) {
        return [];
      }

      const rect = trackLane.getBoundingClientRect();
      return [
        {
          trackId: track.id,
          top: rect.top,
          bottom: rect.bottom,
        },
      ];
    });
  };

  const renderTrackControls = (options: {
    tone: string;
    title: string;
    subtitle: string;
    label: string;
    actions?: ReactNode;
  }) => (
    <div
      className={joinClassNames(
        styles.trackControls,
        compact ? styles.trackControlsCompact : styles.trackControlsRegular,
      )}
    >
      <div className={styles.trackControlsBody}>
        <div className={styles.trackBadgeWrap}>
          <div className={styles.trackBadge} style={{ background: options.tone }}>
            {options.label}
          </div>
        </div>
        <div className={styles.trackTitle}>{options.title}</div>
        <div className={styles.trackSubtitle}>{options.subtitle}</div>
        {options.actions ? <div className={styles.trackActions}>{options.actions}</div> : null}
      </div>
    </div>
  );

  const renderLaneBase = (
    track: TimelineTrack,
    trackHeight: number,
    children: ReactNode,
    laneClassName?: string,
    extraStyle?: CSSProperties,
  ) => (
    <div
      key={track.id}
      className={styles.laneRow}
      style={{ gridTemplateColumns: trackColumns, minHeight: trackHeight }}
    >
      {children}
      <div
        className={joinClassNames(styles.laneMain, laneClassName)}
        style={{
          height: trackHeight,
          ...gridBackground,
          ...extraStyle,
        }}
      />
    </div>
  );

  return (
    <div
      className={styles.root}
      style={{
        gridTemplateRows: `${toolbarHeight}px minmax(0, 1fr)`,
      }}
    >
      <div className={styles.toolbar}>
        <div className={styles.toolbarInfo}>
          <div className={styles.eyebrow}>TIMELINE</div>
          <div className={styles.toolbarMeta}>
            {visualTracks.length} 条视觉轨 · 拖到指定轨道落片
          </div>
        </div>

        <div className={styles.toolbarActions}>
          <button onClick={() => addTrack()} className={styles.trackButton}>
            + 轨道
          </button>
          <button
            onClick={() => setZoomLevel((current) => getNextTimelineZoom(current, 'out'))}
            className={styles.actionButton}
          >
            −
          </button>
          <div className={styles.zoomValue}>{Math.round(zoomLevel * 100)}%</div>
          <button
            onClick={() => setZoomLevel((current) => getNextTimelineZoom(current, 'in'))}
            className={styles.actionButton}
          >
            +
          </button>
          <button
            onClick={() => setZoomLevel(getFitTimelineZoom(durationMs, Math.max(480, viewportWidth || 960)))}
            className={styles.fitButton}
          >
            Fit
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        onClick={handleSeekClick}
        onWheel={handleWheelZoom}
        className={styles.scrollArea}
      >
        <div
          className={styles.canvas}
          style={{
            width: contentWidth + outerPadding * 2,
            padding: outerPadding,
          }}
        >
          <div className={styles.content} style={{ width: contentWidth }}>
            <div
              className={styles.rulerRow}
              style={{ gridTemplateColumns: trackColumns, height: rulerHeight }}
            >
              <div className={styles.rulerSide}>轨道</div>

              <div className={styles.rulerMain} style={{ height: rulerHeight }}>
                {ticks.map((tick) => (
                  <div
                    key={tick}
                    className={styles.tick}
                    style={{ left: tick * pxPerMs }}
                  >
                    <div className={styles.tickMarker} />
                    <div className={styles.tickLabel}>{formatTime(tick)}</div>
                  </div>
                ))}
              </div>
            </div>

            {renderLaneBase(
              timeline.tracks[0],
              audioTrackHeight,
              renderTrackControls({
                tone: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                label: 'AUD',
                title: '口播',
                subtitle: timeline.podcast.audioPath
                  ? getFileNameFromPath(timeline.podcast.audioPath)
                  : '等待导入音频',
              }),
              styles.lockedLane,
              {
                overflow: 'hidden',
              },
            )}
            <div
              className={styles.lockedLaneOverlay}
              style={{
                marginTop: -audioTrackHeight,
                marginLeft: sidebarWidth,
                width: trackWidth,
                height: audioTrackHeight,
              }}
            >
              <TimelineAudioWaveform
                audioPath={timeline.podcast.audioPath}
                durationMs={durationMs}
                trackWidth={trackWidth}
                trackHeight={audioTrackHeight}
              />
            </div>

            {renderLaneBase(
              timeline.tracks[1],
              subtitleTrackHeight,
              renderTrackControls({
                tone: 'linear-gradient(135deg, #f97316, #ea580c)',
                label: 'TXT',
                title: '字幕',
                subtitle: timeline.podcast.srtPath
                  ? getFileNameFromPath(timeline.podcast.srtPath)
                  : '等待导入字幕',
                actions: (
                  <div className={styles.subtitleTools}>
                    <div className={styles.subtitleStatus}>{subtitleHighlightSummary}</div>
                    <div className={styles.subtitleActionRow}>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenSubtitleInspector?.();
                        }}
                        className={styles.subtitleActionButton}
                        type="button"
                      >
                        字幕配置
                      </button>
                    </div>
                  </div>
                ),
              }),
              styles.lockedLane,
            )}
            <div
              className={styles.lockedLaneOverlay}
              style={{
                marginTop: -subtitleTrackHeight,
                marginLeft: sidebarWidth,
                width: trackWidth,
                height: subtitleTrackHeight,
              }}
            >
              <TimelineSubtitleBlocks
                entries={srtEntries}
                durationMs={durationMs}
                pxPerMs={pxPerMs}
                trackHeight={subtitleTrackHeight}
                highlightHint={subtitleHighlightHint}
              />
            </div>

            {visualTracks.map((track, index) => {
              const overlays = overlaysByTrack.get(track.id) ?? [];
              const isHover = hoverTrackId === track.id;
              const isTopLayer = index === 0;

              return (
                <div
                  key={track.id}
                  className={styles.overlayRow}
                  style={{
                    gridTemplateColumns: trackColumns,
                    minHeight: overlayTrackHeight,
                  }}
                >
                  {renderTrackControls({
                    tone: isTopLayer
                      ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
                      : 'linear-gradient(135deg, #475569, #334155)',
                    label: `V${visualTracks.length - index}`,
                    title: track.label,
                    subtitle: isTopLayer ? `最上层 · L${track.order}` : `覆盖级 L${track.order}`,
                  })}
                  <div
                    ref={(node) => {
                      trackLaneRefs.current[track.id] = node;
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'copy';
                      if (hoverTrackId !== track.id) {
                        setHoverTrackId(track.id);
                      }
                    }}
                    onDragLeave={() => {
                      if (hoverTrackId === track.id) {
                        setHoverTrackId(null);
                      }
                    }}
                    onDrop={handleTrackDrop(track.id)}
                    className={joinClassNames(
                      styles.trackDropLane,
                      isHover ? styles.trackDropLaneHover : '',
                    )}
                    style={{
                      height: overlayTrackHeight,
                      ...gridBackground,
                    }}
                  >
                    {overlays.map((overlay) => (
                      <OverlayBlock
                        key={overlay.id}
                        overlay={overlay}
                        pxPerMs={pxPerMs}
                        trackHeight={overlayTrackHeight}
                        getTrackDragZones={getTrackDragZones}
                        onTrackHoverChange={setHoverTrackId}
                        onSelect={() => {
                          const sourceCardId = overlay.aiCardData?.sourceCardId;
                          if (overlay.overlayType === 'ai-card' && sourceCardId) {
                            onOpenAICardInspector?.(sourceCardId);
                          }
                        }}
                      />
                    ))}

                    {overlays.length === 0 ? (
                      <div
                        className={[
                          styles.emptyHint,
                          isHover ? styles.emptyHintHover : '',
                        ].filter(Boolean).join(' ')}
                      >
                        拖入图片或视频到 {track.label}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}

            <div
              className={styles.playhead}
              style={{ left: sidebarWidth + currentTimeMs * pxPerMs }}
            >
              <div className={styles.playheadHandle} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function joinClassNames(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(' ');
}
