import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Toolbar } from '../src/components/Toolbar';

describe('Toolbar', () => {
  it('renders a desktop titlebar shell for setup', () => {
    const html = renderToStaticMarkup(
      <Toolbar
        compact={false}
        page="setup"
        projectName=""
        saveStatus="idle"
        canUndo={false}
        canRedo={false}
        recentProjects={[]}
        onCommand={() => undefined}
        onOpenRecentProject={() => undefined}
      />,
    );

    expect(html).toContain('VIDEO WEB MASTER');
    expect(html).toContain('播客视频编辑器');
    expect(html).toContain('导入 MP3 与 SRT');
  });

  it('renders editor guidance inside the custom titlebar', () => {
    const html = renderToStaticMarkup(
      <Toolbar
        compact
        page="editor"
        projectName=""
        saveStatus="idle"
        canUndo={false}
        canRedo={false}
        recentProjects={[]}
        onCommand={() => undefined}
        onOpenRecentProject={() => undefined}
      />,
    );

    expect(html).toContain('拖入素材');
    expect(html).toContain('Remotion');
  });

  it('renders project menus and save status in editor mode', () => {
    const html = renderToStaticMarkup(
      <Toolbar
        compact={false}
        page="editor"
        projectName="demo-project"
        saveStatus="saved"
        canUndo
        canRedo
        recentProjects={[
          {
            path: '/tmp/demo-project',
            name: 'demo-project',
            lastOpenedAt: 1,
          },
        ]}
        onCommand={() => undefined}
        onOpenRecentProject={() => undefined}
      />,
    );

    expect(html).toContain('项目');
    expect(html).toContain('编辑');
    expect(html).toContain('媒体');
    expect(html).toContain('demo-project');
    expect(html).toContain('已保存');
  });
});
