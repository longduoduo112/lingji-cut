import type { CardStyle } from '../../types/ai';

interface QuoteCardProps {
  content: string;
  style: CardStyle;
}

export function QuoteCard({ content, style }: QuoteCardProps) {
  return (
    <div style={frameStyle(style)}>
      <div style={eyebrowStyle(style.primaryColor)}>HIGHLIGHT</div>
      <div
        style={{
          maxWidth: 1_320,
          fontSize: 52,
          fontWeight: 800,
          lineHeight: 1.5,
          textAlign: 'center',
          background: `linear-gradient(135deg, ${style.primaryColor}, #f472b6)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {content}
      </div>
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
    marginBottom: 36,
  };
}
