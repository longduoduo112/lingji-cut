import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CSSProperties } from 'react';
import type { SrtEntry, SubtitleHighlight, SubtitleStyle } from '../types';
import { filterValidSubtitleHighlights } from '../lib/subtitle-highlights';

interface SubtitleTrackProps {
  entries: SrtEntry[];
  style: SubtitleStyle;
  highlights?: SubtitleHighlight[];
}

export function SubtitleTrack({ entries, style, highlights = [] }: SubtitleTrackProps) {
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
        {renderSubtitleText(
          currentEntry,
          style,
          highlights,
          Math.max(0, frame - Math.round((currentEntry.startMs / 1000) * fps)),
        )}
      </div>
    </AbsoluteFill>
  );
}

function renderSubtitleText(
  entry: SrtEntry,
  style: SubtitleStyle,
  highlights: SubtitleHighlight[],
  frame: number,
) {
  const validHighlight = filterValidSubtitleHighlights([entry], highlights)[0];
  if (!validHighlight || !style.highlightEnabled) {
    return <span style={textStyle(style)}>{entry.text}</span>;
  }

  const before = entry.text.slice(0, validHighlight.start);
  const focus = entry.text.slice(validHighlight.start, validHighlight.end);
  const after = entry.text.slice(validHighlight.end);
  const highlightProgress = Math.min(1, frame / 8);
  const highlightTransform =
    style.highlightAnimation === 'pop'
      ? `scale(${0.96 + highlightProgress * 0.04})`
      : style.highlightAnimation === 'wipe'
        ? `translateY(${(1 - highlightProgress) * 4}px)`
        : 'none';

  return (
    <span style={textStyle(style)}>
      {before}
      <span
        data-subtitle-highlight="true"
        style={highlightStyle(style, highlightTransform)}
      >
        {focus}
      </span>
      {after}
    </span>
  );
}

function textStyle(style: SubtitleStyle): CSSProperties {
  return {
    display: 'inline-block',
    maxWidth: '100%',
    whiteSpace: 'pre-line',
    fontSize: style.fontSize,
    color: style.color,
    fontWeight: 700,
    lineHeight: 1.42,
    textShadow: '0 2px 10px rgba(0,0,0,0.72), 0 0 24px rgba(0,0,0,0.55)',
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
  };
}

function highlightStyle(style: SubtitleStyle, transform: string): CSSProperties {
  return {
    display: 'inline-block',
    margin: '0 0.12em',
    padding: `${style.highlightPaddingY}px ${style.highlightPaddingX}px`,
    borderRadius: style.highlightRadius,
    background: style.highlightBackgroundColor,
    color: style.highlightTextColor,
    boxShadow: '0 10px 24px rgba(0,0,0,0.28)',
    transform,
  };
}
