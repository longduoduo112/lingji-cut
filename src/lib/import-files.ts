export type ImportKind = 'audio' | 'srt';

const ACCEPTED_EXTENSIONS: Record<ImportKind, string[]> = {
  audio: ['.mp3'],
  srt: ['.srt'],
};

export function isAcceptedImportPath(filePath: string, kind: ImportKind): boolean {
  const normalizedFilePath = filePath.toLowerCase();
  return ACCEPTED_EXTENSIONS[kind].some((extension) => normalizedFilePath.endsWith(extension));
}

export function getImportFileError(filePath: string, kind: ImportKind): string | null {
  if (isAcceptedImportPath(filePath, kind)) {
    return null;
  }

  return kind === 'audio' ? '请导入 MP3 音频文件。' : '请导入 SRT 字幕文件。';
}

export function getDroppedFilePath(
  file: File & { path?: string },
  getPathForFile: (file: File) => string,
): string {
  if (file.path) {
    return file.path;
  }

  try {
    return getPathForFile(file) || '';
  } catch {
    return '';
  }
}
