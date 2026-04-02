import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { fitPreviewStage } from '../lib/preview';
import { formatTime, msToFrame } from '../lib/utils';
import { PodcastComposition } from '../remotion/PodcastComposition';
import { useTimelineStore } from '../store/timeline';

interface PreviewPanelProps {
  playerRef: RefObject<PlayerRef | null>;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onExport: () => void;
  currentTimeMs: number;
  durationMs: number;
  compact: boolean;
}

function PreviewPanelComponent({
  playerRef,
  isPlaying,
  onTogglePlay,
  onExport,
  currentTimeMs,
  durationMs,
  compact,
}: PreviewPanelProps) {
  const { timeline, srtEntries } = useTimelineStore();
  const fps = timeline.fps || 30;
  const durationInFrames = useMemo(
    () => Math.max(1, msToFrame(timeline.podcast.durationMs || 1000, fps)),
    [fps, timeline.podcast.durationMs],
  );
  const playerInputProps = useMemo(() => ({ timeline, srtEntries }), [srtEntries, timeline]);
  const previewAreaRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState(() => ({
    width: timeline.width,
    height: timeline.height,
  }));

  useEffect(() => {
    const container = previewAreaRef.current;
    if (!container) {
      return;
    }

    const updateStageSize = () => {
      const nextStageSize = fitPreviewStage(
        container.clientWidth,
        container.clientHeight,
        timeline.width,
        timeline.height,
      );
      setStageSize(nextStageSize);
    };

    updateStageSize();

    const observer = new ResizeObserver(() => {
      updateStageSize();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [timeline.height, timeline.width]);

  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
        borderRadius: 26,
        border: '1px solid rgba(255,255,255,0.08)',
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr) auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(9, 17, 31, 0.92)',
        }}
      >
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.14em', color: '#91a2bc' }}>PREVIEW</div>
          <div style={{ marginTop: 4, fontSize: 16, fontWeight: 700 }}>Remotion Player</div>
        </div>
        <div style={{ fontSize: 12, color: '#91a2bc' }}>
          {timeline.width} × {timeline.height} / {fps}fps
        </div>
      </div>

      <div
        ref={previewAreaRef}
        style={{
          padding: compact ? 14 : 18,
          display: 'grid',
          placeItems: 'center',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: Math.max(0, stageSize.width),
            height: Math.max(0, stageSize.height),
            maxWidth: '100%',
            maxHeight: '100%',
            borderRadius: 18,
            overflow: 'hidden',
            background: '#000',
            boxShadow: '0 22px 50px rgba(0,0,0,0.32)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Player
            ref={playerRef}
            component={PodcastComposition}
            inputProps={playerInputProps}
            durationInFrames={durationInFrames}
            fps={fps}
            compositionWidth={timeline.width}
            compositionHeight={timeline.height}
            controls={false}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              background: '#000',
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: compact ? 'stretch' : 'center',
          justifyContent: 'space-between',
          flexDirection: compact ? 'column' : 'row',
          gap: compact ? 10 : 14,
          padding: compact ? '12px 14px 14px' : '12px 18px 18px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(8, 14, 25, 0.94)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: compact ? 'stretch' : 'center',
            flexDirection: compact ? 'column' : 'row',
            gap: 10,
            minWidth: 0,
          }}
        >
          <button
            onClick={onTogglePlay}
            style={{
              height: 42,
              padding: '0 18px',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.12)',
              background: isPlaying
                ? 'linear-gradient(90deg, rgba(123,213,255,0.24) 0%, rgba(123,213,255,0.14) 100%)'
                : 'rgba(255,255,255,0.05)',
              color: '#f5f7fb',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {isPlaying ? '⏸ 暂停' : '▶ 播放'}
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.05)',
                color: '#edf2fb',
                fontSize: 13,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
            >
              {formatTime(currentTimeMs)} / {formatTime(durationMs)}
            </div>
            <div
              style={{
                padding: '7px 11px',
                borderRadius: 999,
                background: isPlaying ? 'rgba(123,213,255,0.14)' : 'rgba(255,255,255,0.05)',
                color: isPlaying ? '#7bd5ff' : '#91a2bc',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {isPlaying ? '播放中' : '已暂停'}
            </div>
          </div>
        </div>

        <button
          onClick={onExport}
          style={{
            height: 42,
            padding: '0 20px',
            borderRadius: 14,
            border: 'none',
            background: 'linear-gradient(90deg, #ffb547 0%, #ff8f5f 100%)',
            color: '#241200',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 800,
            alignSelf: compact ? 'stretch' : 'auto',
          }}
        >
          导出 MP4
        </button>
      </div>
    </div>
  );
}

export const PreviewPanel = memo(PreviewPanelComponent);
