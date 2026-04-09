import type { DragEvent } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useViewportSize } from '../hooks/useViewportSize';
import { getDroppedFilePath, getImportFileError, type ImportKind } from '../lib/import-files';
import { getSetupLayoutMode } from '../lib/layout';
import { getFileNameFromPath } from '../lib/utils';
import type { RecentProject } from '../store/timeline';
import { Alert, Button, FileDropCard } from '../ui';
import styles from './Setup.module.css';

interface SetupProps {
  busy: boolean;
  errorMessage: string | null;
  projectName: string;
  recentProjects: RecentProject[];
  onComplete: (audioPath: string, srtPath: string) => Promise<void>;
  onOpenRecentProject: (projectDir: string) => Promise<void>;
  onStartScriptWorkbench: () => void;
  onOpenSettings: () => void;
}

function ImportCard({
  label,
  helper,
  value,
  accentColor,
  icon,
  selectLabel,
  onPickFile,
  onDrop,
  compact,
}: {
  label: string;
  helper: string;
  value: string | null;
  accentColor: string;
  icon: string;
  selectLabel: string;
  onPickFile: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  compact: boolean;
}) {
  return (
    <FileDropCard
      eyebrow={label}
      heading={helper}
      value={value ? getFileNameFromPath(value) : null}
      placeholder="把文件从 Finder 直接拖到这里"
      accentColor={accentColor}
      icon={icon}
      action={
        <Button
          type="button"
          onClick={onPickFile}
          variant="secondary"
          style={{ height: 42 }}
        >
          {selectLabel}
        </Button>
      }
      compact={compact}
      onDrop={onDrop}
    />
  );
}

export function Setup({
  busy,
  errorMessage,
  projectName,
  recentProjects,
  onComplete,
  onOpenRecentProject,
  onStartScriptWorkbench,
  onOpenSettings,
}: SetupProps) {
  const viewport = useViewportSize();
  const layout = getSetupLayoutMode(viewport.width, viewport.height);
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [srtPath, setSrtPath] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const canStart = useMemo(() => Boolean(audioPath && srtPath && !busy), [audioPath, busy, srtPath]);

  const applyImportPath = useCallback((kind: ImportKind, filePath: string) => {
    const validationError = getImportFileError(filePath, kind);
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setLocalError(null);
    if (kind === 'audio') {
      setAudioPath(filePath);
      return;
    }

    setSrtPath(filePath);
  }, []);

  const createDropHandler = useCallback(
    (kind: ImportKind) => (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const file = event.dataTransfer.files[0] as (File & { path?: string }) | undefined;
      if (!file) {
        return;
      }

      const filePath = getDroppedFilePath(file, window.electronAPI.getPathForFile);
      if (!filePath) {
        setLocalError('未能读取拖入文件的本地路径，请改用"选择文件"按钮或重试拖拽。');
        return;
      }

      applyImportPath(kind, filePath);
    },
    [applyImportPath],
  );

  const createSelectHandler = useCallback(
    (kind: ImportKind) => async () => {
      const filePath = await window.electronAPI.selectSetupFile(kind);
      if (!filePath) {
        return;
      }

      applyImportPath(kind, filePath);
    },
    [applyImportPath],
  );

  const compact = layout.compactHero;

  return (
    <div className={styles.page}>
      <div className={styles.welcomeContent}>
        {/* Hero 区域 */}
        <div style={{ textAlign: 'center' }}>
          <div className={styles.heroEyebrow} style={{ fontSize: 11, letterSpacing: 2 }}>
            LOCAL PODCAST VIDEO EDITOR
          </div>
          {projectName ? (
            <>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 16px',
                borderRadius: 8,
                background: '#32D74B1A',
                color: '#32D74B',
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 8,
              }}>
                <span style={{ fontSize: 15 }}>📁</span>
                {projectName}
              </div>
              <h1 className={styles.heroTitle} style={{ fontSize: 34 }}>
                选择你的创作方式
              </h1>
              <p className={styles.heroDescription} style={{ fontSize: 15, color: '#EBEBF599' }}>
                项目已就绪，选择 AI 写稿或导入音频字幕开始创作
              </p>
            </>
          ) : (
            <>
              <h1 className={styles.heroTitle} style={{ fontSize: 34 }}>
                选择你的创作方式
              </h1>
              <p className={styles.heroDescription} style={{ fontSize: 15, color: '#EBEBF599' }}>
                AI 智能写稿或直接导入音频字幕，开始制作播客视频
              </p>
            </>
          )}
        </div>

        {/* 双入口卡片 */}
        <div className={styles.entryCards}>
          {/* 左侧：AI 写稿创作 */}
          <div
            className={styles.entryCard}
            onClick={onStartScriptWorkbench}
            style={{ cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: '#0A84FF1A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                }}
              >
                ✨
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0A84FF' }}>AI 驱动</span>
            </div>

            <h3 className={styles.entryCardTitle}>AI 写稿创作</h3>
            <p className={styles.entryCardDesc}>
              {'输入主题，AI 帮你生成播客稿件\n自动匹配模板，一键生成视频'}
            </p>

            <div className={styles.entrySteps}>
              {[
                ['1', '输入主题或粘贴参考文稿'],
                ['2', 'AI 生成结构化播客脚本'],
                ['3', '自动排版并导出视频'],
              ].map(([num, text]) => (
                <div key={num} className={styles.entryStep}>
                  <div
                    className={styles.entryStepDot}
                    style={{ background: '#0A84FF1A', color: '#0A84FF' }}
                  >
                    {num}
                  </div>
                  {text}
                </div>
              ))}
            </div>

            <Button
              variant="accent"
              size="lg"
              style={{ width: '100%', borderRadius: 10 }}
              onClick={(e) => {
                e.stopPropagation();
                onStartScriptWorkbench();
              }}
              leftIcon={<span style={{ fontSize: 14 }}>✏️</span>}
            >
              开始创作
            </Button>
          </div>

          {/* 右侧：导入音频与字幕 */}
          <div className={styles.entryCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: '#32D74B1A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                }}
              >
                🎵
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#32D74B' }}>经典模式</span>
            </div>

            <h3 className={styles.entryCardTitle}>导入音频与字幕</h3>
            <p className={styles.entryCardDesc}>
              {'已有口播录音和字幕文件？\n直接导入，快速进入编辑器'}
            </p>

            <div className={styles.entrySteps}>
              {[
                ['1', '导入 MP3 口播音频文件'],
                ['2', '导入对应 SRT 字幕文件'],
                ['3', '进入编辑器叠加素材并导出'],
              ].map(([num, text]) => (
                <div key={num} className={styles.entryStep}>
                  <div
                    className={styles.entryStepDot}
                    style={{ background: '#32D74B1A', color: '#32D74B' }}
                  >
                    {num}
                  </div>
                  {text}
                </div>
              ))}
            </div>

            <div
              className={styles.importGrid}
              style={{
                gridTemplateColumns:
                  viewport.width < 680 ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
              }}
            >
              <ImportCard
                label="AUDIO"
                helper="拖入 MP3 口播音频"
                value={audioPath}
                accentColor="#79c4ff"
                icon="🎙"
                selectLabel="选择 MP3 文件"
                onPickFile={() => {
                  void createSelectHandler('audio')();
                }}
                onDrop={createDropHandler('audio')}
                compact={compact}
              />
              <ImportCard
                label="SUBTITLE"
                helper="拖入对应 SRT 字幕"
                value={srtPath}
                accentColor="#ffb547"
                icon="📝"
                selectLabel="选择 SRT 文件"
                onPickFile={() => {
                  void createSelectHandler('srt')();
                }}
                onDrop={createDropHandler('srt')}
                compact={compact}
              />
            </div>

            {errorMessage || localError ? (
              <Alert variant="destructive">{localError || errorMessage}</Alert>
            ) : null}

            <Button
              disabled={!canStart}
              onClick={() => {
                if (audioPath && srtPath) {
                  void onComplete(audioPath, srtPath);
                }
              }}
              variant={canStart ? 'accent' : 'secondary'}
              size="lg"
              style={{
                width: '100%',
                borderRadius: 10,
                background: canStart ? undefined : '#3A3A3C',
              }}
              leftIcon={<span style={{ fontSize: 14 }}>📤</span>}
            >
              {busy ? '正在初始化工程...' : '导入文件'}
            </Button>
          </div>
        </div>

        {/* 最近项目 */}
        {recentProjects.length > 0 ? (
          <div style={{ width: '100%', maxWidth: 960, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#EBEBF54D', marginBottom: 12 }}>最近项目</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {recentProjects.map((project) => (
                <button
                  key={project.path}
                  type="button"
                  className={styles.recentChip}
                  onClick={() => {
                    void onOpenRecentProject(project.path);
                  }}
                >
                  📁 {project.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* 底部提示 */}
        <div className={styles.footerNote} style={{ textAlign: 'center', fontSize: 12, color: '#EBEBF54D', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span>所有文件均在本地处理，不会上传至任何服务器</span>
          <button
            type="button"
            onClick={onOpenSettings}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#EBEBF54D',
              fontSize: 12,
            }}
          >
            ⚙️ 系统设置
          </button>
        </div>
      </div>
    </div>
  );
}
