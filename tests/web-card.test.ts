import { describe, expect, it } from 'vitest';
import { normalizeWebCardSrcDoc } from '../src/lib/web-card';

describe('normalizeWebCardSrcDoc', () => {
  it('injects viewport normalization markup once for iframe rendering', () => {
    const normalized = normalizeWebCardSrcDoc(
      '<!doctype html><html><head><title>Card</title></head><body><div>hello</div></body></html>',
    );

    expect(normalized).toContain('data-web-card-normalized="true"');
    expect(normalized).toContain('name="viewport"');
    expect(normalized).toContain('background: #020617');
  });

  it('does not inject duplicate normalization wrappers', () => {
    const source =
      '<!doctype html><html><head><style data-web-card-normalized="true"></style></head><body>ok</body></html>';

    expect(normalizeWebCardSrcDoc(source)).toBe(source);
  });
});
