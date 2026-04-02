import type { CardStyle } from '../../types/ai';

interface ChapterCardProps {
  title: string;
  chapterIndex: number;
  timeRange: string;
  style: CardStyle;
}

export function ChapterCard({ title, chapterIndex, timeRange, style }: ChapterCardProps) {
  return (
    <div style={frameStyle(style)}>
      <div style={eyebrowStyle(style.primaryColor)}>
        CHAPTER {String(chapterIndex).padStart(2, '0')}
      </div>
      <div style={lineStyle(style.primaryColor)} />
      <div style={titleStyle}>{title}</div>
      <div style={timeStyle}>{timeRange}</div>
    </div>
  );
}

function frameStyle(style: CardStyle) {
  return {
    width: 1_920,
    height: 1_080,
    background: style.backgroundColor,
    color: '#e2e8f0',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 120,
    boxSizing: 'border-box' as const,
  };
}

function eyebrowStyle(color: string) {
  return {
    color,
    fontSize: 20,
    letterSpacing: 6,
    marginBottom: 24,
  };
}

function lineStyle(color: string) {
  return {
    width: 84,
    height: 3,
    background: color,
    marginBottom: 36,
  };
}

const titleStyle = {
  fontSize: 56,
  fontWeight: 700,
  textAlign: 'center' as const,
};

const timeStyle = {
  color: '#94a3b8',
  fontSize: 24,
  marginTop: 20,
};
