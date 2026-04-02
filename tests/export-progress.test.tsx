import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExportProgress } from '../src/components/ExportProgress';

describe('ExportProgress', () => {
  it('does not render a background continue action while export is running', () => {
    const html = renderToStaticMarkup(
      <ExportProgress
        visible
        progress={0.42}
        outputPath={null}
        errorMessage={null}
        onClose={() => undefined}
      />,
    );

    expect(html).toContain('正在导出视频');
    expect(html).not.toContain('后台继续');
    expect(html).not.toContain('关闭');
  });

  it('renders a close action after export completes', () => {
    const html = renderToStaticMarkup(
      <ExportProgress
        visible
        progress={1}
        outputPath="/tmp/test.mp4"
        errorMessage={null}
        onClose={() => undefined}
      />,
    );

    expect(html).toContain('导出完成');
    expect(html).toContain('关闭');
  });
});
