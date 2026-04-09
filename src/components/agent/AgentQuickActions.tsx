import { useScriptStore } from '../../store/script';
import { useAgentStore } from '../../store/agent';
import type {
  WorkspaceFilesState,
  ReviewState,
  ActiveStreamState,
} from '../../store/script';
import styles from './AgentQuickActions.module.css';

// ─── Action 类型定义 ────────────────────────────────────────

interface BaseActionDef {
  id: string;
  label: string;
  primary?: boolean;
  tooltip: string;
}

interface AgentPromptAction extends BaseActionDef {
  kind: 'prompt';
  prompt: string;
  operationType: 'generate' | 'review' | 'rewrite' | 'custom';
}

interface UIAction extends BaseActionDef {
  kind: 'ui';
  run: () => void;
}

type ActionDef = AgentPromptAction | UIAction;

// ─── 状态引导提示 ─────────────────────────────────────────

interface StateGuide {
  hint: string;
  description: string;
}

function deriveGuide(ctx: {
  workspaceFiles: WorkspaceFilesState;
  hasActionableAnnotations: boolean;
  reviewState: ReviewState;
  isOperating: boolean;
  agentConnected: boolean;
}): StateGuide {
  if (!ctx.workspaceFiles.hasOriginalFile && !ctx.workspaceFiles.hasScriptFile) {
    return {
      hint: '开始创作',
      description: '导入已有文稿或新建空白文稿开始工作',
    };
  }

  if (ctx.workspaceFiles.hasOriginalFile && !ctx.workspaceFiles.hasScriptFile) {
    if (!ctx.agentConnected) {
      return {
        hint: '原稿已就绪',
        description: 'AI 助手连接中，连接后可一键生成口播稿',
      };
    }
    return {
      hint: '原稿已就绪',
      description: '点击下方按钮，AI 将根据原稿自动生成口播稿',
    };
  }

  if (ctx.isOperating) {
    return {
      hint: 'AI 处理中',
      description: '请稍候，AI 正在工作...',
    };
  }

  if (ctx.workspaceFiles.hasScriptFile && ctx.reviewState === 'idle') {
    if (!ctx.agentConnected) {
      return {
        hint: '口播稿已生成',
        description: 'AI 助手连接中，连接后可进行智能审查',
      };
    }
    return {
      hint: '口播稿已生成',
      description: '可以让 AI 审查口播稿质量，或手动编辑调整',
    };
  }

  if (ctx.hasActionableAnnotations && ctx.reviewState === 'issues') {
    return {
      hint: '审查发现问题',
      description: '点击接受建议自动修正，或逐条查看处理',
    };
  }

  if (ctx.reviewState === 'stale') {
    return {
      hint: '内容已变更',
      description: '文稿内容已修改，建议重新审查',
    };
  }

  if (ctx.reviewState === 'clean') {
    return {
      hint: '审查通过',
      description: '口播稿质量良好，可以复制使用',
    };
  }

  return {
    hint: '就绪',
    description: '口播稿已完成，可以复制使用或继续优化',
  };
}

// ─── 根据工作区状态派生可用操作 ─────────────────────────────

function deriveActions(ctx: {
  workspaceFiles: WorkspaceFilesState;
  hasActionableAnnotations: boolean;
  reviewState: ReviewState;
  isOperating: boolean;
  activeStream: ActiveStreamState;
  agentConnected: boolean;
  callbacks: {
    importText: (() => void) | null;
    createBlank: (() => void) | null;
    focusEditor: (() => void) | null;
    copyScript: () => void;
  };
}): ActionDef[] {
  // 空工作区
  if (!ctx.workspaceFiles.hasOriginalFile && !ctx.workspaceFiles.hasScriptFile) {
    return [
      {
        id: 'import',
        kind: 'ui',
        label: '📄 导入文稿',
        run: () => ctx.callbacks.importText?.(),
        tooltip: '从本地选择文本文件导入为原稿',
        primary: true,
      },
      {
        id: 'blank',
        kind: 'ui',
        label: '📝 新建空白',
        run: () => ctx.callbacks.createBlank?.(),
        tooltip: '创建空白 original.md 开始编写',
      },
    ];
  }

  // 有原稿但尚无口播稿
  if (ctx.workspaceFiles.hasOriginalFile && !ctx.workspaceFiles.hasScriptFile) {
    if (!ctx.agentConnected) {
      // Agent 未连接时不显示 prompt 类按钮
      return [];
    }
    return [
      {
        id: 'generate',
        kind: 'prompt',
        label: '✨ 生成口播稿',
        prompt: '请使用 MCP 工具写稿：先调用 lingji_get_project_context 获取模板列表，再调用 lingji_read_script 读取 original.md，最后调用 lingji_write_script 传入 templateCode 和 rawText 生成口播稿。',
        operationType: 'generate',
        primary: true,
        tooltip: '基于原稿生成口播稿',
      },
    ];
  }

  // Agent 正在操作
  if (ctx.isOperating) {
    return [];
  }

  // 中断状态（部分提交）
  if (ctx.workspaceFiles.hasScriptFile && ctx.activeStream.phase === 'stopped') {
    const actions: ActionDef[] = [
      {
        id: 'continue',
        kind: 'ui',
        label: '继续编辑',
        run: () => ctx.callbacks.focusEditor?.(),
        primary: true,
        tooltip: '保留已提交内容并继续手动编辑',
      },
    ];
    if (ctx.agentConnected) {
      actions.push(
        {
          id: 'regenerate',
          kind: 'prompt',
          label: '重新生成',
          prompt: '请使用 MCP 工具重新写稿：先调用 lingji_get_project_context 获取模板，再调用 lingji_read_script 读取 original.md，最后调用 lingji_write_script 重新生成口播稿。',
          operationType: 'rewrite',
          tooltip: '重新生成口播稿',
        },
        {
          id: 're-review',
          kind: 'prompt',
          label: '重新审查',
          prompt:
            '请重新审查 script.md。不要写文件，只在最终回复中输出一个 `script-review` 代码块，内容为合法 ReviewPayload JSON。',
          operationType: 'review',
          tooltip: '重新审查',
        },
      );
    }
    return actions;
  }

  // 口播稿已存在，审查空闲
  if (ctx.workspaceFiles.hasScriptFile && ctx.reviewState === 'idle') {
    const actions: ActionDef[] = [];
    if (ctx.agentConnected) {
      actions.push(
        {
          id: 'review',
          kind: 'prompt',
          label: '🔍 AI 审查',
          prompt: '请使用 MCP 工具审稿：先调用 lingji_read_script 读取脚本全文，分析后必须调用 lingji_review_script 提交逐行批注（包含 line、text、severity）。',
          operationType: 'review',
          primary: true,
          tooltip: 'AI 审查口播稿',
        },
        {
          id: 'regenerate',
          kind: 'prompt',
          label: '重新生成',
          prompt: '请使用 MCP 工具重新写稿：先调用 lingji_get_project_context 获取模板，再调用 lingji_read_script 读取 original.md，最后调用 lingji_write_script 重新生成口播稿。',
          operationType: 'rewrite',
          tooltip: '重新生成口播稿',
        },
      );
    }
    return actions;
  }

  // 审查发现问题
  if (ctx.hasActionableAnnotations && ctx.reviewState === 'issues') {
    const actions: ActionDef[] = [
      {
        id: 'accept-all',
        kind: 'ui',
        label: '✅ 全部接受',
        run: () => useScriptStore.getState().acceptAllAnnotations(),
        primary: true,
        tooltip: '接受所有建议',
      },
    ];
    if (ctx.agentConnected) {
      actions.push({
        id: 're-review',
        kind: 'prompt',
        label: '重新审查',
        prompt: '请使用 MCP 工具重新审稿：先调用 lingji_read_script 读取脚本全文，重新分析后必须调用 lingji_review_script 提交逐行批注（包含 line、text、severity）。',
        operationType: 'review',
        tooltip: '重新审查',
      });
    }
    return actions;
  }

  // 审查已过期
  if (ctx.reviewState === 'stale') {
    const actions: ActionDef[] = [];
    if (ctx.agentConnected) {
      actions.push(
        {
          id: 're-review',
          kind: 'prompt',
          label: '重新审查',
          prompt:
            '请重新审查 script.md。不要写文件，只在最终回复中输出一个 `script-review` 代码块，内容为合法 ReviewPayload JSON。',
          operationType: 'review',
          primary: true,
          tooltip: '重新审查',
        },
        {
          id: 'regenerate',
          kind: 'prompt',
          label: '重新生成',
          prompt: '请使用 MCP 工具重新写稿：先调用 lingji_get_project_context 获取模板，再调用 lingji_read_script 读取 original.md，最后调用 lingji_write_script 重新生成口播稿。',
          operationType: 'rewrite',
          tooltip: '重新生成',
        },
      );
    }
    return actions;
  }

  // 默认状态（审查通过 / 无可操作标注）
  const actions: ActionDef[] = [
    {
      id: 'copy',
      kind: 'ui',
      label: '📋 复制口播稿',
      run: () => ctx.callbacks.copyScript(),
      tooltip: '复制口播稿内容到剪贴板',
      primary: true,
    },
  ];
  if (ctx.agentConnected) {
    actions.push(
      {
        id: 'regenerate',
        kind: 'prompt',
        label: '重新生成',
        prompt: '请使用 MCP 工具重新写稿：先调用 lingji_get_project_context 获取模板，再调用 lingji_read_script 读取 original.md，最后调用 lingji_write_script 重新生成口播稿。',
        operationType: 'rewrite',
        tooltip: '重新生成',
      },
      {
        id: 're-review',
        kind: 'prompt',
        label: '重新审查',
        prompt: '请使用 MCP 工具重新审稿：先调用 lingji_read_script 读取脚本全文，重新分析后必须调用 lingji_review_script 提交逐行批注（包含 line、text、severity）。',
        operationType: 'review',
        tooltip: '重新审查',
      },
    );
  }
  return actions;
}

// ─── 组件 ───────────────────────────────────────────────────

/** 根据文件状态自适应快捷操作按钮 + 引导提示 */
export function AgentQuickActions() {
  const {
    workspaceFiles,
    annotations,
    reviewState,
    agentOperation,
    activeStream,
    scriptText,
    workbenchCallbacks,
    startAgentOperation,
    setReviewState,
  } = useScriptStore();
  const { status, sidebarOpen } = useAgentStore();

  if (!sidebarOpen) return null;

  const agentConnected = status === 'connected';
  const hasActionableAnnotations = annotations.some(
    (a) => a.status === 'pending' && !a.stale,
  );
  const isOperating = agentOperation.isOperating;

  const sendAgentPrompt = (action: AgentPromptAction) => {
    if (isOperating || !agentConnected) return;
    if (action.operationType === 'review') {
      setReviewState('pending');
    }
    startAgentOperation(action.operationType);
    window.agentAPI?.sendPrompt([{ type: 'text', text: action.prompt }]);
  };

  const copyScript = () => {
    if (scriptText) {
      navigator.clipboard.writeText(scriptText).catch(() => {});
    }
  };

  const guide = deriveGuide({
    workspaceFiles,
    hasActionableAnnotations,
    reviewState,
    isOperating,
    agentConnected,
  });

  const actions = deriveActions({
    workspaceFiles,
    hasActionableAnnotations,
    reviewState,
    isOperating,
    activeStream,
    agentConnected,
    callbacks: {
      importText: workbenchCallbacks.importText,
      createBlank: workbenchCallbacks.createBlank,
      focusEditor: workbenchCallbacks.focusEditor,
      copyScript,
    },
  });

  return (
    <div className={styles.quickActions}>
      <div className={styles.guide}>
        <span className={styles.guideHint}>{guide.hint}</span>
        <span className={styles.guideDesc}>{guide.description}</span>
      </div>
      {actions.length > 0 && (
        <div className={styles.buttons}>
          {actions.map((action) => (
            <button
              key={action.id}
              className={`${styles.btn} ${action.primary ? styles.primary : ''}`}
              disabled={isOperating}
              onClick={() => {
                if (action.kind === 'ui') {
                  action.run();
                } else {
                  sendAgentPrompt(action);
                }
              }}
              title={action.tooltip}
            >
              {action.label}
            </button>
          ))}
          {isOperating && (
            <button
              className={styles.stopBtn}
              onClick={() => window.agentAPI?.cancelTurn()}
            >
              ⏹ 停止
            </button>
          )}
        </div>
      )}
    </div>
  );
}
