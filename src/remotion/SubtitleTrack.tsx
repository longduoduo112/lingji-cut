import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { SrtEntry, SubtitleStyle } from '../types';

interface SubtitleTrackProps {
  entries: SrtEntry[];
  style: SubtitleStyle;
}

export function SubtitleTrack({ entries, style }: SubtitleTrackProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;
  const currentEntry = entries.find((entry) => currentMs >= entry.startMs && currentMs <= entry.endMs);

  if (!currentEntry) {
    return null;
  }

  const positionStyle =
    style.position === 'top'
      ? { top: 60 }
      : style.position === 'center'
        ? { top: '50%', transform: 'translateY(-50%)' }
        : { bottom: 64 };

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          textAlign: 'center',
          padding: '0 80px',
          ...positionStyle,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            maxWidth: '100%',
            whiteSpace: 'pre-line',
            fontSize: style.fontSize,
            color: style.color,
            fontWeight: 700,
            lineHeight: 1.42,
            textShadow: '0 2px 10px rgba(0,0,0,0.72), 0 0 24px rgba(0,0,0,0.55)',
            fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
          }}
        >
          {currentEntry.text}
        </span>
      </div>
    </AbsoluteFill>
  );
}
