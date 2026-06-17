import { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Pencil,
  Search,
  Terminal,
  Wrench,
  X,
} from 'lucide-react';
import { describeToolCallBlock, type ToolCallDescriptor, type ToolDetailSection } from './tool-call-descriptor';
import styles from './AgentTranscript.module.css';

interface ToolCallBlockType {
  type: 'tool_call';
  toolCallId?: string;
  title?: string;
  kind?: string;
  status?: string;
  rawInput?: string;
  rawOutput?: string;
}

type StatusKind = 'running' | 'ok' | 'error';

function textValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function classifyStatus(status?: string): StatusKind {
  const s = textValue(status).toLowerCase();
  if (s === 'completed' || s === 'done' || s === 'success' || s === 'ok') return 'ok';
  if (s === 'failed' || s === 'error') return 'error';
  return 'running';
}

function statusText(kind: StatusKind, commandLike: boolean): string {
  if (kind === 'running') return commandLike ? '执行中' : '运行中';
  if (kind === 'error') return commandLike ? '执行失败' : '调用失败';
  return commandLike ? '已执行' : '已完成';
}

function ToolIcon({ descriptor }: { descriptor: ToolCallDescriptor }) {
  if (descriptor.category === 'command') return <Terminal size={14} strokeWidth={1.8} />;
  if (descriptor.category === 'edit' || descriptor.category === 'write' || descriptor.category === 'delete') {
    return <Pencil size={14} strokeWidth={1.8} />;
  }
  if (descriptor.category === 'read' || descriptor.category === 'search') {
    return <Search size={14} strokeWidth={1.8} />;
  }
  return <Wrench size={14} strokeWidth={1.8} />;
}

function StatusIcon({ kind }: { kind: StatusKind }) {
  if (kind === 'ok') return <Check size={14} strokeWidth={2} aria-label="已完成" />;
  if (kind === 'error') return <X size={14} strokeWidth={2} aria-label="失败" />;
  return <span aria-label="运行中" className="inline-block h-2 w-2 rounded-full bg-mac-blue animate-pulse" />;
}

interface DiffLine {
  kind: 'same' | 'add' | 'remove';
  oldLine: number | null;
  newLine: number | null;
  text: string;
}

function diffFileName(diff: string): string {
  for (const line of diff.split('\n')) {
    const match = /^\+\+\+ b\/(.+)$/.exec(line) || /^\+\+\+\s+(.+)$/.exec(line);
    if (match?.[1] && match[1] !== '/dev/null') return match[1];
  }
  return '文件';
}

function diffLineCount(diff: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('+')) added += 1;
    if (line.startsWith('-')) removed += 1;
  }
  return { added, removed };
}

function parseDiff(diff: string): DiffLine[] {
  const rows: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;
  for (const rawLine of diff.split('\n')) {
    const hunk = /^@@ -(\d+)?(?:,\d+)? \+(\d+)?(?:,\d+)? @@/.exec(rawLine);
    if (hunk) {
      oldLine = Number(hunk[1] || 0);
      newLine = Number(hunk[2] || 0);
      continue;
    }
    if (rawLine.startsWith('+++') || rawLine.startsWith('---') || rawLine.startsWith('diff ')) continue;
    if (!rawLine) continue;
    const marker = rawLine[0];
    const text = rawLine.slice(1);
    if (marker === '+') {
      rows.push({ kind: 'add', oldLine: null, newLine: newLine || null, text });
      if (newLine) newLine += 1;
    } else if (marker === '-') {
      rows.push({ kind: 'remove', oldLine: oldLine || null, newLine: null, text });
      if (oldLine) oldLine += 1;
    } else if (marker === ' ') {
      rows.push({ kind: 'same', oldLine: oldLine || null, newLine: newLine || null, text });
      if (oldLine) oldLine += 1;
      if (newLine) newLine += 1;
    }
  }
  return rows.slice(0, 160);
}

function DiffSection({ diff }: { diff: string }) {
  const rows = parseDiff(diff);
  const count = diffLineCount(diff);
  return (
    <div className={styles.diffCard}>
      <div className={styles.diffHeader}>
        <span className={styles.diffFileName}>{diffFileName(diff)}</span>
        <span className={styles.plus}>+{count.added}</span>
        <span className={styles.minus}>-{count.removed}</span>
      </div>
      {rows.length === 0 ? (
        <div className={styles.emptyDiff}>文件内容无可展示差异</div>
      ) : (
        <table className={styles.diffTable}>
          <tbody>
            {rows.map((line, index) => {
              const isAdd = line.kind === 'add';
              const isRemove = line.kind === 'remove';
              return (
                <tr
                  key={`${line.kind}-${line.oldLine ?? line.newLine ?? index}-${index}`}
                  className={isAdd ? styles.diffRowAdd : isRemove ? styles.diffRowRemove : ''}
                >
                  <td className={`${styles.lineNo} ${isAdd ? styles.lineNoAdd : isRemove ? styles.lineNoRemove : ''}`}>
                    {line.oldLine ?? line.newLine ?? ''}
                  </td>
                  <td className={styles.lineCode}>{line.text || ' '}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function DetailSection({ section }: { section: ToolDetailSection }) {
  if (section.kind === 'diff') {
    return <DiffSection diff={section.content} />;
  }

  const preClassName =
    section.kind === 'shell'
        ? `${styles.detailPre} ${styles.detailShell}`
      : section.kind === 'text'
        ? `${styles.detailPre} ${styles.detailText}`
        : styles.detailPre;
  return (
    <div className={styles.detailSection}>
      <div className={styles.detailLabel}>{section.label}</div>
      <pre className={preClassName}>{section.content}</pre>
    </div>
  );
}

export function ToolCallBlock({
  block,
  defaultExpanded,
}: {
  block: ToolCallBlockType;
  defaultExpanded?: boolean;
}) {
  const statusKind = classifyStatus(block.status);
  const descriptor = describeToolCallBlock(block);
  const hasDetail = descriptor.sections.length > 0;
  const commandLike = descriptor.category === 'command';
  const title = descriptor.label;
  const status = statusText(statusKind, commandLike);
  const [expanded, setExpanded] = useState(defaultExpanded ?? statusKind === 'error');
  const statusClass =
    statusKind === 'error'
      ? styles.eventStatusError
      : statusKind === 'ok'
        ? styles.eventStatusOk
        : '';

  return (
    <div className={styles.event}>
      <button
        type="button"
        onClick={() => hasDetail && setExpanded((value) => !value)}
        disabled={!hasDetail}
        className={`${styles.eventHeader} ${hasDetail ? styles.eventHeaderInteractive : ''}`}
        aria-expanded={hasDetail ? expanded : undefined}
      >
        <span className={styles.eventIcon}>
          <ToolIcon descriptor={descriptor} />
        </span>
        <span className={styles.eventLabel}>{title}</span>
        <span className={`${styles.eventStatus} ${statusClass}`}>
          <StatusIcon kind={statusKind} /> {status}
        </span>
        {/* subject 直接拼在 header 同一行：读取/编辑/写入显示路径、命令显示 shell 一行。
            命令类用等宽字体的内联 code 风格；其他类用普通 eventTitle 文本风格。
            折叠态下不再额外渲染单独的 "目标 / 命令 xxx" 预览块——保持与读取文件同一排版语言。 */}
        {descriptor.subject ? (
          commandLike ? (
            <code className={`${styles.eventTitle} ${styles.eventTitleMono}`} title={descriptor.subject}>
              {descriptor.subject}
            </code>
          ) : (
            <span className={styles.eventTitle} title={descriptor.subject}>{descriptor.subject}</span>
          )
        ) : null}
        {descriptor.meta.map((item) => (
          <span key={item} className={styles.eventStatus}>{item}</span>
        ))}
        {hasDetail ? (
          <span className={styles.eventChevron} aria-hidden>
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        ) : null}
      </button>

      {hasDetail && expanded ? (
        <div className={styles.toolDetails}>
          {descriptor.sections.map((section) => (
            <DetailSection key={`${section.label}:${section.content.slice(0, 24)}`} section={section} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
