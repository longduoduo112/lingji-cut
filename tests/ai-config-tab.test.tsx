import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AIConfigTab } from '../src/components/settings/AIConfigTab';

describe('AIConfigTab', () => {
  it('renders the thinking mode switch in the AI settings page', () => {
    const html = renderToStaticMarkup(<AIConfigTab />);

    expect(html).toContain('AI 基础配置');
    expect(html).toContain('开启思考模式');
  });
});
