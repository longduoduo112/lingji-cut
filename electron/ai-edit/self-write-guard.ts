/**
 * 自写抑制：主进程写项目文件后记录"刚写入的内容"，
 * chokidar 监听到同内容变更时识别为自身回声并跳过转发，打断 autosave↔watch 回环。
 * 命中即清除（一次性），避免长期占用；未命中（真实外部编辑）正常放行。
 */
const recent = new Map<string, string>();

/** 主进程写文件后调用：记录该绝对路径刚写入的内容。 */
export function markSelfWrite(absPath: string, content: string): void {
  recent.set(absPath, content);
}

/**
 * chokidar 读到变更后调用：若 content 与最近一次自写完全相同，判为自身回声，
 * 返回 true 并清除记录；否则返回 false（真实外部编辑）。
 */
export function consumeSelfWrite(absPath: string, content: string): boolean {
  if (recent.get(absPath) === content) {
    recent.delete(absPath);
    return true;
  }
  return false;
}
