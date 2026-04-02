import { useMemo, useState } from 'react';
import type { MenuAction } from '../lib/electron-api';
import type { RecentProject, SaveStatus } from '../store/timeline';

interface ToolbarProps {
  compact: boolean;
  page: 'setup' | 'editor';
  projectName: string;
  saveStatus: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  recentProjects: RecentProject[];
  onCommand: (command: MenuAction) => void;
  onOpenRecentProject: (projectPath: string) => void;
}

const saveStatusLabelMap: Record<SaveStatus, string> = {
  idle: '未打开工程',
  saving: '保存中',
  saved: '已保存',
  error: '保存失败',
};

const baseMenuButtonStyle = {
  height: 34,
  padding: '0 12px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  color: '#f5f7fb',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
};

const shortcutTextStyle = {
  color: '#6f829d',
  fontSize: 12,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

export function Toolbar({
  compact,
  page,
  projectName,
  saveStatus,
  canUndo,
  canRedo,
  recentProjects,
  onCommand,
  onOpenRecentProject,
}: ToolbarProps) {
  const [openMenu, setOpenMenu] = useState<'project' | 'edit' | 'media' | null>(null);
  const helperText =
    page === 'setup'
      ? '导入 MP3 与 SRT 后，即可进入时间轴编辑。'
      : '拖入素材、调整时间轴，并直接导出 Remotion 视频。';
  const saveStatusLabel = saveStatusLabelMap[saveStatus];
  const visibleProjectName = projectName || (page === 'editor' ? '未命名工程' : '欢迎页');
  const menus = useMemo(
    () => [
      {
        key: 'project' as const,
        label: '项目',
        items: [
          ['新建项目', 'Cmd/Ctrl+N', () => onCommand('new-project')],
          ['打开项目', 'Cmd/Ctrl+O', () => onCommand('open-project')],
          ['关闭项目', '', () => onCommand('close-project')],
          ['在 Finder 中显示', '', () => onCommand('show-project-in-folder')],
        ],
      },
      {
        key: 'edit' as const,
        label: '编辑',
        items: [
          ['撤销', 'Cmd/Ctrl+Z', () => onCommand('undo')],
          ['重做', 'Cmd/Ctrl+Shift+Z', () => onCommand('redo')],
        ],
      },
      {
        key: 'media' as const,
        label: '媒体',
        items: [
          ['替换音频', '', () => onCommand('replace-audio')],
          ['替换字幕', '', () => onCommand('replace-srt')],
          ['添加素材', '', () => onCommand('add-asset')],
          ['导出 MP4', 'Cmd/Ctrl+E', () => onCommand('export')],
        ],
      },
    ],
    [onCommand],
  );

  return (
    <div
      style={{
        minHeight: compact ? 62 : 58,
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, auto) minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 12,
        padding: compact ? '8px 12px' : '8px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'linear-gradient(180deg, rgba(9,17,31,0.98) 0%, rgba(7,12,22,0.94) 100%)',
        backdropFilter: 'blur(18px)',
        WebkitAppRegion: 'drag',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minWidth: 0,
          position: 'relative',
          WebkitAppRegion: 'no-drag',
        }}
      >
        {menus.map((menu) => (
          <div key={menu.key} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setOpenMenu((current) => (current === menu.key ? null : menu.key))}
              style={baseMenuButtonStyle}
            >
              {menu.label}
            </button>

            {openMenu === menu.key ? (
              <div
                style={{
                  position: 'absolute',
                  top: 42,
                  left: 0,
                  minWidth: menu.key === 'project' ? 256 : 220,
                  padding: 10,
                  borderRadius: 16,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(7, 12, 22, 0.98)',
                  boxShadow: '0 18px 42px rgba(0,0,0,0.36)',
                  zIndex: 10,
                }}
              >
                {menu.items.map(([label, shortcut, handler]) => {
                  const disabled =
                    (menu.key === 'edit' && label === '撤销' && !canUndo) ||
                    (menu.key === 'edit' && label === '重做' && !canRedo) ||
                    (page !== 'editor' &&
                      ['关闭项目', '在 Finder 中显示', '替换音频', '替换字幕', '导出 MP4'].includes(
                        label,
                      ));

                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        if (disabled) {
                          return;
                        }
                        setOpenMenu(null);
                        handler();
                      }}
                      style={{
                        width: '100%',
                        minHeight: 38,
                        padding: '0 10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        borderRadius: 10,
                        border: 'none',
                        background: disabled ? 'transparent' : 'rgba(255,255,255,0.03)',
                        color: disabled ? '#526379' : '#f5f7fb',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <span>{label}</span>
                      {shortcut ? <span style={shortcutTextStyle}>{shortcut}</span> : null}
                    </button>
                  );
                })}

                {menu.key === 'project' && recentProjects.length > 0 ? (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ padding: '0 10px 6px', fontSize: 11, letterSpacing: '0.14em', color: '#7bd5ff' }}>
                      打开最近项目
                    </div>
                    {recentProjects.map((project) => (
                      <button
                        key={project.path}
                        type="button"
                        onClick={() => {
                          setOpenMenu(null);
                          onOpenRecentProject(project.path);
                        }}
                        style={{
                          width: '100%',
                          minHeight: 40,
                          padding: '8px 10px',
                          borderRadius: 10,
                          border: 'none',
                          background: 'rgba(255,255,255,0.03)',
                          color: '#f5f7fb',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{project.name}</div>
                        <div
                          style={{
                            marginTop: 2,
                            color: '#6f829d',
                            fontSize: 11,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {project.path}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div
        style={{
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 18,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.18em', color: '#7bd5ff' }}>
            VIDEO WEB MASTER
          </div>
          <div style={{ marginTop: 2, fontSize: compact ? 16 : 17, fontWeight: 700 }}>
            播客视频编辑器
          </div>
          <div
            style={{
              marginTop: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: '#91a2bc',
              fontSize: 12,
            }}
          >
            <span>{visibleProjectName}</span>
            <span
              style={{
                padding: '3px 8px',
                borderRadius: 999,
                background:
                  saveStatus === 'error' ? 'rgba(255,110,110,0.16)' : 'rgba(255,255,255,0.06)',
                color: saveStatus === 'error' ? '#ff8b8b' : '#b7c3d6',
              }}
            >
              {saveStatusLabel}
            </span>
          </div>
        </div>
        <div
          style={{
            color: '#91a2bc',
            fontSize: 12,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textAlign: 'right',
          }}
        >
          {helperText}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: '#91a2bc',
          fontSize: 12,
          WebkitAppRegion: 'no-drag',
        }}
      >
        <div style={{ whiteSpace: 'nowrap' }}>{page === 'editor' ? '编辑中' : '准备导入'}</div>
        <button
          type="button"
          disabled={page !== 'editor'}
          onClick={() => onCommand('export')}
          style={{
            ...baseMenuButtonStyle,
            color: page === 'editor' ? '#f5f7fb' : '#526379',
            cursor: page === 'editor' ? 'pointer' : 'not-allowed',
          }}
        >
          导出 MP4
        </button>
      </div>
    </div>
  );
}
