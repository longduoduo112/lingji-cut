import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  FileText,
  FolderOpen,
  FolderSearch,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import {
  Alert,
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Textarea,
} from '../../ui';
import { getFileNameFromPath } from '../../lib/utils';
import styles from './ImportScriptDialog.module.css';

const ALLOWED_EXTENSIONS = ['.md', '.txt'] as const;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB 上限，避免误拖音视频

function stripExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx <= 0) return name;
  return name.slice(0, idx);
}

function hasAllowedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export interface ImportScriptDialogProps {
  open: boolean;
  busy: boolean;
  errorMessage: string | null;
  onOpenChange: (open: boolean) => void;
  /** 确认导入：传入父目录、项目名、原稿内容；由父组件创建项目并跳转工作台 */
  onConfirm: (parentDir: string, projectName: string, content: string) => Promise<void> | void;
}

export function ImportScriptDialog({
  open,
  busy,
  errorMessage,
  onOpenChange,
  onConfirm,
}: ImportScriptDialogProps) {
  const [content, setContent] = useState('');
  const [projectName, setProjectName] = useState('');
  const [parentDir, setParentDir] = useState<string | null>(null);
  const [sourceFileName, setSourceFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [readingFile, setReadingFile] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const dragDepthRef = useRef(0);

  // 弹窗关闭时重置状态
  useEffect(() => {
    if (!open) {
      setContent('');
      setProjectName('');
      setParentDir(null);
      setSourceFileName(null);
      setIsDragging(false);
      setReadingFile(false);
      setLocalError(null);
      dragDepthRef.current = 0;
    }
  }, [open]);

  const trimmedName = projectName.trim();
  const canConfirm = useMemo(
    () => Boolean(content.trim() && trimmedName && parentDir && !busy && !readingFile),
    [content, trimmedName, parentDir, busy, readingFile],
  );

  const applyFile = useCallback(async (file: File) => {
    if (!hasAllowedExtension(file.name)) {
      setLocalError(`仅支持 ${ALLOWED_EXTENSIONS.join(' / ')} 文件`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setLocalError(`文件过大（${(file.size / 1024 / 1024).toFixed(1)} MB），上限 5 MB`);
      return;
    }
    setReadingFile(true);
    setLocalError(null);
    try {
      const text = await file.text();
      setContent(text);
      setSourceFileName(file.name);
      // 仅当用户尚未自定义项目名时，用文件名预填
      setProjectName((prev) => (prev.trim() ? prev : stripExtension(file.name)));
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : '读取文件失败');
    } finally {
      setReadingFile(false);
    }
  }, []);

  const handleSelectFileClick = useCallback(async () => {
    setLocalError(null);
    const result = await window.electronAPI.selectTextFile();
    if (!result) return;
    if (!hasAllowedExtension(result.path)) {
      setLocalError(`仅支持 ${ALLOWED_EXTENSIONS.join(' / ')} 文件`);
      return;
    }
    setContent(result.content);
    const name = getFileNameFromPath(result.path);
    setSourceFileName(name);
    setProjectName((prev) => (prev.trim() ? prev : stripExtension(name)));
  }, []);

  const handleSelectDir = useCallback(async () => {
    const dir = await window.electronAPI.selectProjectDirectory();
    if (dir) setParentDir(dir);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer?.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragDepthRef.current = 0;
      setIsDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) void applyFile(file);
    },
    [applyFile],
  );

  const handleClearSource = useCallback(() => {
    setContent('');
    setSourceFileName(null);
    setLocalError(null);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!canConfirm || !parentDir) return;
    void onConfirm(parentDir, trimmedName, content);
  }, [canConfirm, parentDir, trimmedName, content, onConfirm]);

  const previewPath = parentDir && trimmedName ? `${parentDir}/${trimmedName}` : null;
  const displayedError = errorMessage ?? localError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogClose />
        <DialogHeader>
          <DialogTitle>导入文稿</DialogTitle>
          <DialogDescription>
            粘贴原稿、拖拽文件或选择 .md / .txt 文件，导入后自动创建项目并开始 AI 写稿
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {/* 文稿来源：textarea + drop zone + 选择文件 */}
          <Field label="文稿内容">
            <div
              className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ''}`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="在此粘贴或输入原稿内容，也可以拖拽 .md / .txt 文件到这里"
                rows={8}
                resize="vertical"
              />
              {isDragging && (
                <div className={styles.dropOverlay}>
                  <Upload size={28} strokeWidth={1.5} />
                  <span>松开以载入文件</span>
                </div>
              )}
            </div>

            <div className={styles.sourceActions}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleSelectFileClick()}
                disabled={readingFile}
              >
                {readingFile ? (
                  <>
                    <Loader2 size={14} className={styles.spinIcon} />
                    读取中
                  </>
                ) : (
                  <>
                    <FileText size={14} strokeWidth={1.7} />
                    选择文件…
                  </>
                )}
              </Button>
              {sourceFileName && (
                <span className={styles.sourceTag}>
                  <CheckCircle2 size={13} strokeWidth={2} className={styles.sourceTagIcon} />
                  <span className={styles.sourceTagName}>{sourceFileName}</span>
                  <button
                    type="button"
                    className={styles.sourceTagClear}
                    onClick={handleClearSource}
                    aria-label="清除已加载文件"
                  >
                    <X size={12} strokeWidth={2} />
                  </button>
                </span>
              )}
            </div>
          </Field>

          {/* 项目名 */}
          <div style={{ marginTop: 'var(--space-6)' }}>
            <Field label="项目名称" hint="将作为项目文件夹名">
              <Input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="例如：我的第一期播客"
                leftIcon={<FolderOpen size={16} strokeWidth={1.5} />}
              />
            </Field>
          </div>

          {/* 父目录 */}
          <div style={{ marginTop: 'var(--space-6)' }}>
            <Field label="存放目录">
              <button
                type="button"
                className={styles.dirPickerButton}
                onClick={() => void handleSelectDir()}
              >
                <FolderSearch size={20} strokeWidth={1.5} />
                <span className={styles.dirPickerText}>
                  {parentDir ?? '选择项目存放目录'}
                </span>
              </button>
            </Field>
          </div>

          {/* 路径预览 */}
          {previewPath && (
            <div className={styles.projectPath}>
              <FolderOpen size={14} strokeWidth={1.5} />
              <span>项目将创建在：{previewPath}</span>
            </div>
          )}

          {/* 错误提示 */}
          {displayedError && (
            <div style={{ marginTop: 'var(--space-6)' }}>
              <Alert variant="error">{displayedError}</Alert>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={busy}>取消</Button>
          </DialogClose>
          <Button variant="primary" disabled={!canConfirm} onClick={handleConfirm}>
            {busy ? '创建中…' : '创建项目并开始创作'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
