/**
 * 待创作箱（设计文档第 6 节）。
 *
 * 列出声呐扩展经本地桥推入的二创素材（转录稿 + 元数据）。
 * 「生成初稿」复用现有 autoMode 流水线：上层把转录稿写成 original.md 后起飞 AI 二创写稿。
 * 桥配置区展示本机端点 + token，供用户复制进扩展设置。
 */
import { useCallback, useEffect, useState } from 'react';
import { Inbox, RefreshCw, Trash2, Sparkles, Copy, FolderOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { Alert, Button } from '../../ui';
import {
  canDraftInboxItem,
  type SonarInboxItem,
} from '../../lib/sonar-inbox';
import styles from './SonarInboxPanel.module.css';

interface SonarInboxPanelProps {
  /** 生成初稿：传入收件项与父目录，上层复用 onImportScript 走 autoMode 流水线。 */
  onDraft: (item: SonarInboxItem, parentDir: string) => Promise<void>;
}

const STATUS_LABEL: Record<SonarInboxItem['status'], string> = {
  pending: '待创作',
  creating: '生成中',
  drafted: '已生成',
  failed: '失败',
};

export function SonarInboxPanel({ onDraft }: SonarInboxPanelProps) {
  const [items, setItems] = useState<SonarInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [parentDir, setParentDir] = useState<string | null>(null);
  const [bridge, setBridge] = useState<{ port: number; token: string } | null>(null);
  const [showBridge, setShowBridge] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;

  const refresh = useCallback(async () => {
    if (!api?.sonarInboxList) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await api.sonarInboxList();
      setItems(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '读取待创作箱失败');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void refresh();
    if (api?.sonarBridgeInfo) {
      void api.sonarBridgeInfo().then(setBridge).catch(() => {});
    }
    // 扩展推送到桥后，主进程派发 sonar-inbox-updated → 实时刷新，无需手动点刷新。
    const off = api?.onSonarInboxUpdated?.(() => void refresh());
    return () => off?.();
  }, [refresh, api]);

  const pickDir = useCallback(async () => {
    const dir = await api?.selectProjectDirectory?.();
    if (dir) setParentDir(dir);
  }, [api]);

  const handleDraft = useCallback(
    async (item: SonarInboxItem) => {
      if (!parentDir) {
        setError('请先选择保存项目的父目录');
        return;
      }
      setBusyId(item.id);
      setError(null);
      try {
        await api?.sonarInboxMarkStatus?.(item.id, 'creating');
        await onDraft(item, parentDir);
        // onDraft 通常会导航到 auto-run，本组件随欢迎页卸载。
      } catch (e) {
        const msg = e instanceof Error ? e.message : '生成初稿失败';
        setError(msg);
        await api?.sonarInboxMarkStatus?.(item.id, 'failed', { error: msg }).catch(() => {});
        void refresh();
      } finally {
        setBusyId(null);
      }
    },
    [api, onDraft, parentDir, refresh],
  );

  const handleRemove = useCallback(
    async (item: SonarInboxItem) => {
      await api?.sonarInboxRemove?.(item.id).catch(() => {});
      void refresh();
    },
    [api, refresh],
  );

  const copyToken = useCallback(() => {
    if (!bridge) return;
    void navigator.clipboard?.writeText(bridge.token).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [bridge]);

  // 桌面端 IPC 不可用（如纯 web）或为空且无桥信息：不渲染。
  if (!api?.sonarInboxList) return null;
  if (!loading && items.length === 0 && !bridge) return null;

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.title}>
          <Inbox size={16} />
          <span>待创作箱</span>
          <span className={styles.subtitle}>来自声呐监听的二创素材</span>
        </div>
        <div className={styles.headerActions}>
          {bridge ? (
            <button className={styles.linkBtn} onClick={() => setShowBridge((v) => !v)}>
              {showBridge ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              桥配置
            </button>
          ) : null}
          <button className={styles.linkBtn} onClick={() => void refresh()} disabled={loading}>
            <RefreshCw size={14} className={loading ? styles.spin : undefined} />
            刷新
          </button>
        </div>
      </header>

      {showBridge && bridge ? (
        <div className={styles.bridgeBox}>
          <div className={styles.bridgeRow}>
            <span className={styles.bridgeLabel}>端点</span>
            <code className={styles.bridgeValue}>http://127.0.0.1:{bridge.port}</code>
          </div>
          <div className={styles.bridgeRow}>
            <span className={styles.bridgeLabel}>Token</span>
            <code className={styles.bridgeValue}>{bridge.token}</code>
            <button className={styles.iconBtn} onClick={copyToken} title="复制 token">
              <Copy size={13} />
            </button>
            {copied ? <span className={styles.copied}>已复制</span> : null}
          </div>
          <p className={styles.bridgeHint}>
            ① 安装并打开「声呐」浏览器扩展（Chrome → 扩展程序 → 加载 <code>extensions/sonar/dist</code>）。
            ② 在扩展「设置 → 灵机剪影联动」点「🔗 一键连接灵机剪影」即可，无需手动复制以上 token。
          </p>
        </div>
      ) : null}

      <div className={styles.dirRow}>
        <Button variant="secondary" size="sm" onClick={() => void pickDir()}>
          <FolderOpen size={14} />
          {parentDir ? '更改父目录' : '选择父目录'}
        </Button>
        <span className={styles.dirText}>{parentDir ?? '未选择保存位置'}</span>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id} className={styles.item}>
            {item.coverUrl ? (
              <img src={item.coverUrl} alt="" className={styles.cover} />
            ) : (
              <div className={styles.coverPlaceholder} />
            )}
            <div className={styles.itemBody}>
              <div className={styles.itemMeta}>
                <span className={styles.creator}>{item.creatorName}</span>
                <span className={`${styles.badge} ${styles[`badge_${item.status}`]}`}>
                  {STATUS_LABEL[item.status]}
                </span>
              </div>
              <div className={styles.itemTitle}>{item.title}</div>
              <div className={styles.transcript}>{item.transcript.fullText.slice(0, 90)}</div>
            </div>
            <div className={styles.itemActions}>
              <Button
                size="sm"
                onClick={() => void handleDraft(item)}
                disabled={busyId === item.id || !canDraftInboxItem(item) || item.status === 'creating'}
              >
                <Sparkles size={14} />
                {busyId === item.id ? '处理中…' : '生成初稿'}
              </Button>
              <button className={styles.iconBtn} onClick={() => void handleRemove(item)} title="移除">
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
