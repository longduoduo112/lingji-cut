import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AICoverPanel } from '../src/components/AICoverPanel';

describe('AICoverPanel', () => {
  it('renders prompts and generated cover candidates', () => {
    const html = renderToStaticMarkup(
      <AICoverPanel
        coverPrompts={['一张科技感播客封面']}
        candidates={[
          {
            id: 'cover-1',
            prompt: '一张科技感播客封面',
            imageUrl: '/tmp/cover-1.png',
            selected: true,
          },
        ]}
        isGenerating={false}
        onGenerateCovers={() => undefined}
        onSelectCover={() => undefined}
      />,
    );

    expect(html).toContain('提示词');
    expect(html).toContain('一张科技感播客封面');
    expect(html).toContain('候选封面');
  });
});
