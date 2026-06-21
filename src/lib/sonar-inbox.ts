/**
 * 声呐「待创作箱」渲染侧类型与纯helper（设计文档第 6 节）。
 *
 * 收件项由扩展经 /sonar/enqueue 推入桌面端，欢迎页「待创作箱」消费。
 * 「生成初稿」复用现有 autoMode 流水线：转录稿 → original.md → AI 二创 script.md → … 。
 * 这里只放纯逻辑（派生项目名 / 组装 original.md），便于单测。
 */

export type SonarInboxStatus = 'pending' | 'creating' | 'drafted' | 'failed';

export interface SonarInboxTranscriptSegment {
  text: string;
  startMs: number;
  endMs: number;
}

export interface SonarInboxItem {
  id: string;
  source: string;
  awemeId: string;
  creatorId: string;
  creatorName: string;
  title: string;
  url: string;
  coverUrl?: string;
  publishedAt: number;
  durationMs?: number;
  transcript: {
    fullText: string;
    srtText: string;
    segments: SonarInboxTranscriptSegment[];
  };
  status: SonarInboxStatus;
  projectPath?: string;
  error?: string;
  receivedAt: number;
  updatedAt: number;
}

const MAX_NAME_LEN = 60;
// 文件系统非法字符（保留连字符作分隔）。
const ILLEGAL_FS_CHARS = /[\\/:*?"<>|]/g;

/** 清理文件系统非法字符，折叠空白，限长。 */
export function sanitizeProjectName(raw: string): string {
  const cleaned = (raw ?? '')
    .replace(ILLEGAL_FS_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const name = cleaned || '未命名';
  return name.length > MAX_NAME_LEN ? name.slice(0, MAX_NAME_LEN).trim() : name;
}

/** 由收件项派生项目目录名：`{博主}-{标题}`，清理并限长。 */
export function deriveProjectName(item: Pick<SonarInboxItem, 'creatorName' | 'title'>): string {
  const creator = (item.creatorName ?? '').trim();
  const title = (item.title ?? '').trim();
  const combined = creator && title ? `${creator}-${title}` : creator || title || '未命名作品';
  return sanitizeProjectName(combined);
}

/**
 * 组装 original.md 内容：二创素材就是转录稿全文。
 * 保持纯净（不加 frontmatter），因 AI 写稿模板以整段 original.md 作为 {{rawText}}。
 */
export function inboxItemToOriginalMarkdown(item: SonarInboxItem): string {
  return (item.transcript?.fullText ?? '').trim();
}

/** 收件项是否可生成初稿（有非空转录）。 */
export function canDraftInboxItem(item: SonarInboxItem): boolean {
  return Boolean(item.transcript?.fullText?.trim());
}
