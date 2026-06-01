import { describe, expect, it } from 'vitest';
import { DEFAULT_PROMPT_YAML } from '../src/lib/prompts/defaults';
import { getStyleFacetBlock } from '../src/lib/card-style';

describe('提示词 styleSystemBlock 占位符', () => {
  it('cards.segment 含占位符', () => {
    expect(DEFAULT_PROMPT_YAML['cards.segment']).toContain('{{styleSystemBlock}}');
  });
  it('cover.regeneration 含占位符', () => {
    expect(DEFAULT_PROMPT_YAML['cover.regeneration']).toContain('{{styleSystemBlock}}');
  });
  it('card.image 含占位符', () => {
    expect(DEFAULT_PROMPT_YAML['card.image']).toContain('{{styleSystemBlock}}');
  });
});

describe('editorial-eink facet 非空（motion/cover）', () => {
  it('motion facet 含「电子杂志」锚点', () => {
    expect(getStyleFacetBlock('editorial-eink', 'motion')).toContain('电子杂志');
  });
  it('cover facet 含「缩略图」锚点', () => {
    expect(getStyleFacetBlock('editorial-eink', 'cover')).toContain('缩略图');
  });
});
