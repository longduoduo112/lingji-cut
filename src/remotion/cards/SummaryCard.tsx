import type { CardStyle } from '../../types/ai';

interface SummaryCardProps {
  title: string;
  content: string;
  style: CardStyle;
}

export function SummaryCard({ title, content, style }: SummaryCardProps) {
  return (
    <div style={frameStyle(style)}>
      <div style={eyebrowStyle(style.primaryColor)}>SUMMARY</div>
      <div style={titleStyle(style.fontSize)}>{title}</div>
      <div style={bodyStyle}>{content}</div>
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

function titleStyle(fontSize: number) {
  return {
    fontSize,
    fontWeight: 700,
    marginBottom: 36,
    textAlign: 'center' as const,
  };
}

const bodyStyle = {
  maxWidth: 1_400,
  color: '#94a3b8',
  fontSize: 32,
  lineHeight: 1.8,
  textAlign: 'center' as const,
  whiteSpace: 'pre-wrap' as const,
};
