import type { CardStyle } from '../../types/ai';

interface InsightCardProps {
  title: string;
  content: string;
  style: CardStyle;
}

export function InsightCard({ title, content, style }: InsightCardProps) {
  return (
    <div style={frameStyle(style)}>
      <div style={eyebrowStyle(style.primaryColor)}>INSIGHT</div>
      <div style={quoteStyle(style.primaryColor)}>"</div>
      <div style={bodyStyle}>{content}</div>
      <div style={authorStyle}>{title}</div>
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
    marginBottom: 16,
  };
}

function quoteStyle(color: string) {
  return {
    color,
    fontSize: 72,
    lineHeight: 0.8,
    marginBottom: 24,
  };
}

const bodyStyle = {
  maxWidth: 1_260,
  fontSize: 36,
  lineHeight: 1.8,
  textAlign: 'center' as const,
  fontStyle: 'italic' as const,
};

const authorStyle = {
  color: '#94a3b8',
  fontSize: 24,
  marginTop: 32,
};
