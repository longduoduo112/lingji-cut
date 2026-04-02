import { describe, expect, it, vi } from 'vitest';
import { createApplicationMenuTemplate } from '../electron/app-menu';

describe('createApplicationMenuTemplate', () => {
  it('provides native clipboard actions in the edit menu', () => {
    const template = createApplicationMenuTemplate(vi.fn());
    const editMenu = template.find((item) => item.label === '编辑');
    const devMenu = template.find((item) => item.label === '开发');

    expect(editMenu).toBeDefined();
    expect(editMenu?.submenu).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'undo' }),
        expect.objectContaining({ role: 'redo' }),
        expect.objectContaining({ role: 'cut' }),
        expect.objectContaining({ role: 'copy' }),
        expect.objectContaining({ role: 'paste' }),
        expect.objectContaining({ role: 'selectAll' }),
      ]),
    );
    expect(devMenu?.submenu).toEqual(
      expect.arrayContaining([expect.objectContaining({ role: 'toggleDevTools' })]),
    );
  });
});
