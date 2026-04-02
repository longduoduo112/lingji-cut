import type { MenuItemConstructorOptions } from 'electron';
import type { MenuAction } from '../src/lib/electron-api';

export function createApplicationMenuTemplate(
  sendMenuAction: (action: MenuAction) => void,
): MenuItemConstructorOptions[] {
  return [
    {
      label: '项目',
      submenu: [
        {
          label: '新建项目',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendMenuAction('new-project'),
        },
        {
          label: '打开项目',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendMenuAction('open-project'),
        },
        {
          label: '关闭项目',
          click: () => sendMenuAction('close-project'),
        },
        {
          label: '在 Finder 中显示',
          click: () => sendMenuAction('show-project-in-folder'),
        },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '全选', role: 'selectAll' },
      ],
    },
    {
      label: '媒体',
      submenu: [
        {
          label: '替换音频',
          click: () => sendMenuAction('replace-audio'),
        },
        {
          label: '替换字幕',
          click: () => sendMenuAction('replace-srt'),
        },
        {
          label: '添加素材',
          click: () => sendMenuAction('add-asset'),
        },
        {
          label: '导出 MP4',
          accelerator: 'CmdOrCtrl+E',
          click: () => sendMenuAction('export'),
        },
      ],
    },
    {
      label: '开发',
      submenu: [
        { label: '切换开发者工具', role: 'toggleDevTools' },
        { label: '重新加载', role: 'reload' },
        { label: '强制重新加载', role: 'forceReload' },
      ],
    },
  ];
}
