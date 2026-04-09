import { useScriptStore } from '../../store/script';
import styles from './AgentProgressBar.module.css';

const OP_LABELS: Record<string, string> = {
  generate: '生成中',
  review: '审查中',
  rewrite: '重写中',
  custom: '处理中',
};

const BG_LABELS: Record<string, string> = {
  generate: '后台生成中...',
  review: '后台审查中...',
  rewrite: '后台重写中...',
  custom: '后台处理中...',
};

export function AgentProgressBar() {
  const { agentOperation, activeStream } = useScriptStore();
  const hasLivePhase =
    activeStream.phase === 'preparing' ||
    activeStream.phase === 'streaming' ||
    activeStream.phase === 'finalizing';
  const streamKind =
    activeStream.kind ??
    (agentOperation.operationType === 'generate' || agentOperation.operationType === 'rewrite'
      ? agentOperation.operationType
      : null);
  const isLocalUpdatePlayback = !agentOperation.isOperating && streamKind === 'update' && hasLivePhase;

  if (!agentOperation.isOperating && !isLocalUpdatePlayback) return null;

  // 后台模式：紧凑展示
  if (agentOperation.backgrounded) {
    const bgLabel = BG_LABELS[agentOperation.operationType ?? 'custom'] ?? '后台处理中...';
    return (
      <div className={styles.bgContainer}>
        <div className={styles.bgSpinner} />
        <span className={styles.bgLabel}>{bgLabel}</span>
      </div>
    );
  }

  const isLivePlayback = hasLivePhase && streamKind !== null;

  if (isLivePlayback) {
    const liveLabel =
      streamKind === 'update'
        ? activeStream.phase === 'preparing'
          ? 'AI 正在准备更新文稿'
          : activeStream.phase === 'finalizing'
            ? 'AI 正在完成修改'
            : 'AI 正在更新文稿'
        : activeStream.phase === 'preparing'
          ? 'AI 正在准备写稿'
          : activeStream.phase === 'finalizing'
            ? 'AI 正在收尾'
            : 'AI 正在写稿';

    const liveDescription =
      streamKind === 'update'
        ? activeStream.phase === 'preparing'
          ? '正在准备回放修改内容'
          : activeStream.phase === 'finalizing'
            ? '正在完成修改并同步状态'
            : '正在把改动逐段写入编辑器'
        : activeStream.phase === 'preparing'
          ? '正在初始化模板和编辑器会话'
          : activeStream.phase === 'finalizing'
            ? '正在完成最后片段并保存文件'
            : '正在逐段写入编辑器';

    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.icon}>🤖</span>
          <span className={styles.label}>{liveLabel}</span>
          <span className={styles.liveDots} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </div>
        <div className={styles.description}>{liveDescription}</div>
        <div className={styles.liveTrack}>
          <div className={styles.liveBar} />
        </div>
        {agentOperation.isOperating && agentOperation.canInterrupt && (
          <button
            className={styles.stopBtn}
            onClick={() => window.agentAPI?.cancelTurn()}
          >
            ⏹ 停止
          </button>
        )}
      </div>
    );
  }

  // 前台模式：完整进度条
  const label = OP_LABELS[agentOperation.operationType ?? 'custom'] ?? '处理中';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.icon}>🤖</span>
        <span className={styles.label}>{label}</span>
        <span className={styles.percent}>{agentOperation.progress}%</span>
      </div>
      <div className={styles.track}>
        <div
          className={styles.bar}
          style={{ width: `${agentOperation.progress}%` }}
        />
      </div>
      {agentOperation.canInterrupt && (
        <button
          className={styles.stopBtn}
          onClick={() => window.agentAPI?.cancelTurn()}
        >
          ⏹ 停止
        </button>
      )}
    </div>
  );
}
