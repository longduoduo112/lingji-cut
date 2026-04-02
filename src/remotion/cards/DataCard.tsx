import type { CardStyle, DataContent } from '../../types/ai';

interface DataCardProps {
  title: string;
  content: DataContent;
  style: CardStyle;
}

export function DataCard({ title, content, style }: DataCardProps) {
  const numericValues = content.items
    .map((item) => (typeof item.value === 'number' ? item.value : 0))
    .filter((value) => value > 0);
  const maxValue = Math.max(...numericValues, 1);

  return (
    <div style={frameStyle(style)}>
      <div style={eyebrowStyle(style.primaryColor)}>DATA</div>
      <div style={titleStyle(style.fontSize - 4)}>{title}</div>
      <div style={barsStyle}>
        {content.items.map((item) => {
          const numericValue = typeof item.value === 'number' ? item.value : 0;
          const height = Math.max(20, (numericValue / maxValue) * 280);
          return (
            <div key={`${item.label}-${item.value}`} style={itemStyle}>
              <div style={valueStyle}>{String(item.value)}</div>
              <div
                style={{
                  width: 84,
                  height,
                  borderRadius: '10px 10px 0 0',
                  background: item.highlight ? style.primaryColor : `${style.primaryColor}99`,
                }}
              />
              <div style={labelStyle}>{item.label}</div>
            </div>
          );
        })}
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
    marginBottom: 24,
  };
}

function titleStyle(fontSize: number) {
  return {
    fontSize,
    fontWeight: 700,
    marginBottom: 54,
    textAlign: 'center' as const,
  };
}

const barsStyle = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 48,
  height: 360,
};

const itemStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  gap: 12,
};

const valueStyle = {
  color: '#cbd5e1',
  fontSize: 24,
};

const labelStyle = {
  color: '#94a3b8',
  fontSize: 22,
};
