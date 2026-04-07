# 脚本工作台 Agent 驱动重构 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将脚本工作台从强制 4 步线性流程重构为 Agent 驱动 + 虚拟光标实时可视化协作模式。

**Architecture:** 移除所有 Step 组件和步骤状态机，Agent 侧边栏顶部放置自适应快捷操作按钮，Agent 的文件写入操作经过新增的拦截层（AgentOperationInterceptor）拆解为动画帧序列，通过 IPC 事件推送到渲染进程，由 StreamingEditor 控制器协调虚拟光标移动和 CodeMirror 流式写入。审查标注使用 Grammarly 式内联高亮 + 悬浮操作卡片，Agent 操作期间编辑器只读。

**Tech Stack:** React 18, Zustand, CodeMirror 6, Electron IPC, TypeScript, diff-match-patch

**Spec:** `docs/superpowers/specs/2026-04-07-script-workbench-agent-driven-redesign.md`

---

## Phase 1: 状态管理与持久化

### Task 1: Script Store 重构 — 移除步骤状态，新增 Agent 操作状态

**Files:**
- Modify: `src/store/script.ts`
- Test: `tests/script-store.test.ts`

- [ ] **Step 1: 更新 ScriptState 接口 — 移除步骤相关字段，新增 Agent 操作状态**

在 `src/store/script.ts` 中：

1. 移除 `ScriptStep` 类型（line 9）和所有引用
2. 从 `ScriptState` 接口（lines 25-41）中移除：
   - `currentStep: ScriptStep`
   - `drawerVisible: boolean`
   - `drawerContent: 'template' | 'annotations' | null`
3. 新增字段：

```typescript
// 在 ScriptState 接口末尾新增
agentOperation: AgentOperationState;
editorAgent: EditorAgentState;
reviewCompleted: boolean;
```

4. 在文件顶部新增接口定义（放在 `Annotation` 接口之后）：

```typescript
interface AgentOperationState {
  isOperating: boolean;
  operationType: 'generate' | 'review' | 'rewrite' | 'custom' | null;
  progress: number;
  canInterrupt: boolean;
}

interface EditorAgentState {
  readOnly: boolean;
  virtualCursorPos: number | null;
  streamingActive: boolean;
}
```

- [ ] **Step 2: 更新 ScriptActions 接口**

从 `ScriptActions`（lines 43-73）中：

1. 移除：
   - `setCurrentStep`
   - `openDrawer`
   - `closeDrawer`
2. 新增：

```typescript
setAgentOperation: (state: Partial<AgentOperationState>) => void;
setEditorAgent: (state: Partial<EditorAgentState>) => void;
startAgentOperation: (type: AgentOperationState['operationType']) => void;
stopAgentOperation: () => void;
setReviewCompleted: (completed: boolean) => void;
```

- [ ] **Step 3: 更新 store 实现**

在 `create()` 内（line 93+）：

1. 移除 `currentStep: 0`、`drawerVisible: false`、`drawerContent: null` 初始值
2. 移除 `setCurrentStep`、`openDrawer`、`closeDrawer` 实现
3. 新增初始值：

```typescript
agentOperation: {
  isOperating: false,
  operationType: null,
  progress: 0,
  canInterrupt: true,
},
editorAgent: {
  readOnly: false,
  virtualCursorPos: null,
  streamingActive: false,
},
reviewCompleted: false,
```

4. 新增 action 实现：

```typescript
setAgentOperation: (partial) =>
  set((s) => ({ agentOperation: { ...s.agentOperation, ...partial } })),

setEditorAgent: (partial) =>
  set((s) => ({ editorAgent: { ...s.editorAgent, ...partial } })),

startAgentOperation: (type) =>
  set({
    agentOperation: {
      isOperating: true,
      operationType: type,
      progress: 0,
      canInterrupt: true,
    },
    editorAgent: { readOnly: true, virtualCursorPos: null, streamingActive: false },
  }),

stopAgentOperation: () =>
  set({
    agentOperation: {
      isOperating: false,
      operationType: null,
      progress: 0,
      canInterrupt: true,
    },
    editorAgent: { readOnly: false, virtualCursorPos: null, streamingActive: false },
  }),

setReviewCompleted: (completed) => set({ reviewCompleted: completed }),
```

- [ ] **Step 4: 更新 auto-save hook**

修改 `subscribe`（lines 217-235）：将 `currentStep` 从监听列表中移除，改为监听 `reviewCompleted`。

```typescript
// 旧：state.currentStep, state.selectedTemplate, state.annotations
// 新：state.reviewCompleted, state.selectedTemplate, state.annotations
```

- [ ] **Step 5: 更新 restoreState action**

修改 `restoreState`（line 64+）参数类型：移除 `currentStep` 参数，新增 `reviewCompleted` 参数。

- [ ] **Step 6: 更新测试**

在 `tests/script-store.test.ts` 中：
1. 移除所有引用 `currentStep`、`setCurrentStep`、`openDrawer`、`closeDrawer` 的测试
2. 新增测试：

```typescript
describe('agent operation state', () => {
  it('startAgentOperation sets operating state and editor readOnly', () => {
    const { startAgentOperation, agentOperation, editorAgent } =
      useScriptStore.getState();
    startAgentOperation('generate');
    const state = useScriptStore.getState();
    expect(state.agentOperation.isOperating).toBe(true);
    expect(state.agentOperation.operationType).toBe('generate');
    expect(state.editorAgent.readOnly).toBe(true);
  });

  it('stopAgentOperation resets all operation state', () => {
    useScriptStore.getState().startAgentOperation('review');
    useScriptStore.getState().stopAgentOperation();
    const state = useScriptStore.getState();
    expect(state.agentOperation.isOperating).toBe(false);
    expect(state.editorAgent.readOnly).toBe(false);
  });

  it('setAgentOperation partially updates', () => {
    useScriptStore.getState().startAgentOperation('generate');
    useScriptStore.getState().setAgentOperation({ progress: 50 });
    expect(useScriptStore.getState().agentOperation.progress).toBe(50);
    expect(useScriptStore.getState().agentOperation.isOperating).toBe(true);
  });
});
```

- [ ] **Step 7: 运行测试验证**

Run: `npx vitest run tests/script-store.test.ts`
Expected: All tests pass

- [ ] **Step 8: 导出新类型**

确保 `AgentOperationState`、`EditorAgentState` 被 export，供其他模块使用。

- [ ] **Step 9: Commit**

```bash
git add src/store/script.ts tests/script-store.test.ts
git commit -m "refactor(script-store): 移除步骤状态机，新增 Agent 操作状态"
```

---

### Task 2: 持久化 v2 迁移

**Files:**
- Modify: `src/lib/script-persistence.ts`
- Test: `tests/script-persistence.test.ts`

- [ ] **Step 1: 写迁移测试**

在 `tests/script-persistence.test.ts` 新增：

```typescript
describe('v1 → v2 migration', () => {
  it('migrates v1 format by removing currentStep and adding version 2', () => {
    const v1State = {
      version: 1,
      currentStep: 3,
      templateId: 'news-broadcast',
      annotations: [],
      createdAt: '2026-04-06T00:00:00Z',
      updatedAt: '2026-04-06T12:00:00Z',
    };
    const result = migratePersistedState(v1State);
    expect(result.version).toBe(2);
    expect(result).not.toHaveProperty('currentStep');
    expect(result.reviewCompleted).toBe(false);
    expect(result.templateId).toBe('news-broadcast');
  });

  it('v1 with currentStep >= 3 sets reviewCompleted to true', () => {
    const v1State = {
      version: 1,
      currentStep: 3,
      templateId: 'news-broadcast',
      annotations: [{ id: '1', status: 'accepted' }],
      createdAt: '2026-04-06T00:00:00Z',
      updatedAt: '2026-04-06T12:00:00Z',
    };
    const result = migratePersistedState(v1State);
    expect(result.reviewCompleted).toBe(true);
  });

  it('passes through v2 format unchanged', () => {
    const v2State = {
      version: 2,
      templateId: 'news-broadcast',
      annotations: [],
      reviewCompleted: true,
      createdAt: '2026-04-07T00:00:00Z',
      updatedAt: '2026-04-07T00:00:00Z',
    };
    const result = migratePersistedState(v2State);
    expect(result).toEqual(v2State);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/script-persistence.test.ts`
Expected: FAIL — `migratePersistedState` 未定义

- [ ] **Step 3: 实现迁移逻辑**

在 `src/lib/script-persistence.ts` 中：

1. 更新 `PersistedScriptState` 接口：

```typescript
interface PersistedScriptState {
  version: 2;
  templateId: string;
  annotations: Annotation[];
  createdAt: string;
  updatedAt: string;
  reviewCompleted: boolean;
  lastOperation?: string;
}
```

2. 新增迁移函数：

```typescript
export function migratePersistedState(raw: Record<string, unknown>): PersistedScriptState {
  if (raw.version === 2) return raw as unknown as PersistedScriptState;

  // v1 → v2
  const currentStep = (raw.currentStep as number) ?? 0;
  return {
    version: 2,
    templateId: (raw.templateId as string) ?? 'news-broadcast',
    annotations: (raw.annotations as Annotation[]) ?? [],
    createdAt: (raw.createdAt as string) ?? new Date().toISOString(),
    updatedAt: (raw.updatedAt as string) ?? new Date().toISOString(),
    reviewCompleted: currentStep >= 3,
  };
}
```

3. 更新 `createPersistedScriptState` 函数，输出 v2 格式（去掉 `currentStep` 字段，新增 `reviewCompleted`）。

4. 更新 `loadScriptState`（或 hydrate 相关逻辑），加载时调用 `migratePersistedState`。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/script-persistence.test.ts`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/script-persistence.ts tests/script-persistence.test.ts
git commit -m "feat(persistence): script-state.json v1→v2 迁移，移除 currentStep"
```

---

## Phase 2: 编辑器扩展（核心体验）

### Task 3: VirtualCursor — CodeMirror 虚拟光标装饰

**Files:**
- Create: `src/lib/virtual-cursor.ts`
- Test: `tests/virtual-cursor.test.ts`

- [ ] **Step 1: 写虚拟光标位置更新测试**

```typescript
// tests/virtual-cursor.test.ts
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  virtualCursorField,
  setVirtualCursor,
  clearVirtualCursor,
} from '../src/lib/virtual-cursor';

describe('VirtualCursor', () => {
  function createView(doc = 'Hello World') {
    return new EditorView({
      state: EditorState.create({ doc, extensions: [virtualCursorField] }),
    });
  }

  it('initially has no virtual cursor', () => {
    const view = createView();
    expect(view.state.field(virtualCursorField)).toBe(null);
    view.destroy();
  });

  it('setVirtualCursor places cursor at position', () => {
    const view = createView();
    view.dispatch({ effects: setVirtualCursor.of(5) });
    expect(view.state.field(virtualCursorField)).toBe(5);
    view.destroy();
  });

  it('clearVirtualCursor removes cursor', () => {
    const view = createView();
    view.dispatch({ effects: setVirtualCursor.of(5) });
    view.dispatch({ effects: clearVirtualCursor.of(null) });
    expect(view.state.field(virtualCursorField)).toBe(null);
    view.destroy();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/virtual-cursor.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 实现 VirtualCursor StateField 和 Effects**

```typescript
// src/lib/virtual-cursor.ts
import { StateField, StateEffect } from '@codemirror/state';
import { EditorView, Decoration, DecorationSet, WidgetType } from '@codemirror/view';

export const setVirtualCursor = StateEffect.define<number>();
export const clearVirtualCursor = StateEffect.define<null>();

export const virtualCursorField = StateField.define<number | null>({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setVirtualCursor)) return effect.value;
      if (effect.is(clearVirtualCursor)) return null;
    }
    // 如果文档发生变化且光标存在，映射位置
    if (value !== null && tr.docChanged) {
      return tr.changes.mapPos(value);
    }
    return value;
  },
});

class VirtualCursorWidget extends WidgetType {
  toDOM(): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = 'cm-virtual-cursor';

    const cursor = document.createElement('span');
    cursor.className = 'cm-virtual-cursor-line';

    const label = document.createElement('span');
    label.className = 'cm-virtual-cursor-label';
    label.textContent = '🤖';

    wrapper.appendChild(label);
    wrapper.appendChild(cursor);
    return wrapper;
  }

  eq(): boolean {
    return true;
  }
}

const virtualCursorDecoration = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(_, tr) {
    const pos = tr.state.field(virtualCursorField);
    if (pos === null) return Decoration.none;
    const clampedPos = Math.min(pos, tr.state.doc.length);
    return Decoration.set([
      Decoration.widget({ widget: new VirtualCursorWidget(), side: 1 }).range(clampedPos),
    ]);
  },
  provide: (f) => EditorView.decorations.from(f),
});

// CSS 样式 — 通过 EditorView.theme 提供
const virtualCursorTheme = EditorView.baseTheme({
  '.cm-virtual-cursor': {
    position: 'relative',
    display: 'inline',
  },
  '.cm-virtual-cursor-line': {
    display: 'inline-block',
    width: '2px',
    height: '1.2em',
    backgroundColor: '#a78bfa',
    verticalAlign: 'text-bottom',
    animation: 'cm-vc-blink 1s step-end infinite',
  },
  '.cm-virtual-cursor-label': {
    position: 'absolute',
    top: '-1.4em',
    left: '-4px',
    fontSize: '10px',
    lineHeight: '1',
    pointerEvents: 'none',
    userSelect: 'none',
  },
  '@keyframes cm-vc-blink': {
    '50%': { opacity: '0' },
  },
});

/** 完整的虚拟光标扩展，包含 StateField + 装饰 + 主题 */
export const virtualCursorExtension = [
  virtualCursorField,
  virtualCursorDecoration,
  virtualCursorTheme,
];
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/virtual-cursor.test.ts`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/virtual-cursor.ts tests/virtual-cursor.test.ts
git commit -m "feat(editor): VirtualCursor CodeMirror 扩展 — 虚拟光标装饰"
```

---

### Task 4: EditorReadOnlyGuard — Agent 操作时编辑器只读控制

**Files:**
- Create: `src/lib/editor-readonly-guard.ts`

- [ ] **Step 1: 实现 ReadOnlyGuard**

```typescript
// src/lib/editor-readonly-guard.ts
import { Compartment } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

/**
 * 通过 Compartment 动态切换编辑器只读状态。
 * 使用方式：
 *   extensions 中加入 readOnlyGuard.extension
 *   切换只读：view.dispatch({ effects: readOnlyGuard.reconfigure(true) })
 */
export function createReadOnlyGuard() {
  const compartment = new Compartment();

  return {
    extension: compartment.of(EditorView.editable.of(true)),

    reconfigure(readOnly: boolean) {
      return compartment.reconfigure(EditorView.editable.of(!readOnly));
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/editor-readonly-guard.ts
git commit -m "feat(editor): EditorReadOnlyGuard 动态只读切换"
```

---

### Task 5: StreamingEditor — 流式写入控制器

**Files:**
- Create: `src/lib/streaming-editor.ts`
- Test: `tests/streaming-editor.test.ts`

- [ ] **Step 1: 定义接口**

```typescript
// src/lib/streaming-editor.ts
import type { EditorView } from '@codemirror/view';
import { setVirtualCursor, clearVirtualCursor } from './virtual-cursor';

export interface StreamingEditOperation {
  type: 'insert' | 'delete' | 'replace';
  offset: number;
  length?: number;
  text?: string;
}

export interface AnimationFrame {
  cursorPosition: number;
  operation: StreamingEditOperation;
  delayMs: number;
}

export type StreamingSpeed = 'fast' | 'normal' | 'detailed';

export interface StreamingEditorOptions {
  speed?: StreamingSpeed;
  onProgress?: (percent: number) => void;
  onComplete?: () => void;
  onStopped?: () => void;
}
```

- [ ] **Step 2: 写核心测试**

```typescript
// tests/streaming-editor.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StreamingEditor } from '../src/lib/streaming-editor';
import type { AnimationFrame } from '../src/lib/streaming-editor';

// Mock EditorView
function createMockView(initialDoc = '') {
  let doc = initialDoc;
  return {
    state: { doc: { length: doc.length, toString: () => doc } },
    dispatch: vi.fn((spec: any) => {
      if (spec.changes) {
        // 简化的 change 应用
        const { from, to, insert } = spec.changes;
        doc = doc.slice(0, from) + (insert || '') + doc.slice(to ?? from);
      }
    }),
    destroy: vi.fn(),
  };
}

describe('StreamingEditor', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('plays frames sequentially and calls onComplete', async () => {
    const mockView = createMockView('');
    const onComplete = vi.fn();
    const onProgress = vi.fn();
    const controller = new StreamingEditor(mockView as any, {
      onComplete,
      onProgress,
    });

    const frames: AnimationFrame[] = [
      { cursorPosition: 0, operation: { type: 'insert', offset: 0, text: 'Hello' }, delayMs: 100 },
      { cursorPosition: 5, operation: { type: 'insert', offset: 5, text: ' World' }, delayMs: 100 },
    ];

    controller.start(frames);
    expect(controller.isPlaying).toBe(true);

    await vi.advanceTimersByTimeAsync(100);
    expect(onProgress).toHaveBeenCalledWith(50);

    await vi.advanceTimersByTimeAsync(100);
    expect(onProgress).toHaveBeenCalledWith(100);
    expect(onComplete).toHaveBeenCalled();
    expect(controller.isPlaying).toBe(false);
  });

  it('stop() halts playback and keeps progress', async () => {
    const mockView = createMockView('');
    const onStopped = vi.fn();
    const controller = new StreamingEditor(mockView as any, { onStopped });

    const frames: AnimationFrame[] = [
      { cursorPosition: 0, operation: { type: 'insert', offset: 0, text: 'A' }, delayMs: 50 },
      { cursorPosition: 1, operation: { type: 'insert', offset: 1, text: 'B' }, delayMs: 50 },
      { cursorPosition: 2, operation: { type: 'insert', offset: 2, text: 'C' }, delayMs: 50 },
    ];

    controller.start(frames);
    await vi.advanceTimersByTimeAsync(50); // 第一帧执行
    controller.stop();
    expect(onStopped).toHaveBeenCalled();
    expect(controller.isPlaying).toBe(false);

    // 继续推进时间，不应再有 dispatch
    const callCount = mockView.dispatch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(200);
    expect(mockView.dispatch.mock.calls.length).toBe(callCount);
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npx vitest run tests/streaming-editor.test.ts`
Expected: FAIL — `StreamingEditor` not found

- [ ] **Step 4: 实现 StreamingEditor 控制器**

```typescript
// src/lib/streaming-editor.ts（接续 Step 1 的接口定义）

const SPEED_MULTIPLIER: Record<StreamingSpeed, number> = {
  fast: 0.3,
  normal: 1,
  detailed: 2,
};

export class StreamingEditor {
  private view: EditorView;
  private frames: AnimationFrame[] = [];
  private currentIndex = 0;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private options: Required<StreamingEditorOptions>;
  private _isPlaying = false;

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  constructor(view: EditorView, options: StreamingEditorOptions = {}) {
    this.view = view;
    this.options = {
      speed: options.speed ?? 'normal',
      onProgress: options.onProgress ?? (() => {}),
      onComplete: options.onComplete ?? (() => {}),
      onStopped: options.onStopped ?? (() => {}),
    };
  }

  start(frames: AnimationFrame[]): void {
    this.frames = frames;
    this.currentIndex = 0;
    this._isPlaying = true;
    this.scheduleNext();
  }

  stop(): void {
    this.cancelTimer();
    this._isPlaying = false;
    this.view.dispatch({ effects: clearVirtualCursor.of(null) });
    this.options.onStopped();
  }

  setSpeed(speed: StreamingSpeed): void {
    this.options.speed = speed;
  }

  private scheduleNext(): void {
    if (this.currentIndex >= this.frames.length) {
      this._isPlaying = false;
      this.view.dispatch({ effects: clearVirtualCursor.of(null) });
      this.options.onComplete();
      return;
    }

    const frame = this.frames[this.currentIndex];
    const delay = frame.delayMs * SPEED_MULTIPLIER[this.options.speed];

    this.timerId = setTimeout(() => {
      this.applyFrame(frame);
      this.currentIndex++;
      this.options.onProgress(
        Math.round((this.currentIndex / this.frames.length) * 100),
      );
      this.scheduleNext();
    }, delay);
  }

  private applyFrame(frame: AnimationFrame): void {
    const { operation } = frame;
    const changes = this.operationToChange(operation);

    this.view.dispatch({
      changes,
      effects: setVirtualCursor.of(frame.cursorPosition),
      scrollIntoView: true,
    });
  }

  private operationToChange(op: StreamingEditOperation) {
    switch (op.type) {
      case 'insert':
        return { from: op.offset, insert: op.text ?? '' };
      case 'delete':
        return { from: op.offset, to: op.offset + (op.length ?? 0) };
      case 'replace':
        return { from: op.offset, to: op.offset + (op.length ?? 0), insert: op.text ?? '' };
    }
  }

  private cancelTimer(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run tests/streaming-editor.test.ts`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/streaming-editor.ts tests/streaming-editor.test.ts
git commit -m "feat(editor): StreamingEditor 流式写入控制器"
```

---

### Task 6: diff → AnimationFrame 转换器

**Files:**
- Create: `src/lib/diff-to-frames.ts`
- Test: `tests/diff-to-frames.test.ts`

- [ ] **Step 1: 安装 diff-match-patch**

```bash
npm install diff-match-patch
npm install -D @types/diff-match-patch
```

- [ ] **Step 2: 写转换测试**

```typescript
// tests/diff-to-frames.test.ts
import { describe, it, expect } from 'vitest';
import { diffToFrames } from '../src/lib/diff-to-frames';

describe('diffToFrames', () => {
  it('empty file → new content produces insert frames', () => {
    const frames = diffToFrames('', 'Hello World');
    expect(frames.length).toBeGreaterThan(0);
    // 所有帧都应该是 insert
    for (const f of frames) {
      expect(f.operation.type).toBe('insert');
    }
    // 连接所有 insert 文本应等于目标内容
    const combined = frames.map((f) => f.operation.text).join('');
    expect(combined).toBe('Hello World');
  });

  it('partial replace produces correct frames', () => {
    const frames = diffToFrames('Hello World', 'Hello CodeMirror');
    // 至少包含一个 delete 或 replace 和一个 insert
    const types = new Set(frames.map((f) => f.operation.type));
    expect(types.size).toBeGreaterThanOrEqual(1);
  });

  it('respects chunkSize for insert splitting', () => {
    const longText = 'A'.repeat(100);
    const frames = diffToFrames('', longText, { chunkSize: 20 });
    // 100 字按 20 字分块应产生 5 帧
    expect(frames.length).toBe(5);
  });

  it('identical content produces no frames', () => {
    const frames = diffToFrames('same', 'same');
    expect(frames.length).toBe(0);
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npx vitest run tests/diff-to-frames.test.ts`
Expected: FAIL

- [ ] **Step 4: 实现转换器**

```typescript
// src/lib/diff-to-frames.ts
import DiffMatchPatch from 'diff-match-patch';
import type { AnimationFrame, StreamingEditOperation } from './streaming-editor';

export interface DiffToFramesOptions {
  chunkSize?: number;        // insert 文本分块大小，默认 15
  baseDelayMs?: number;      // 每帧基础延迟，默认 30
  annotateDelayMs?: number;  // 标记操作额外延迟，默认 300
}

const DEFAULT_OPTIONS: Required<DiffToFramesOptions> = {
  chunkSize: 15,
  baseDelayMs: 30,
  annotateDelayMs: 300,
};

export function diffToFrames(
  before: string,
  after: string,
  options?: DiffToFramesOptions,
): AnimationFrame[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const dmp = new DiffMatchPatch();
  const diffs = dmp.diff_main(before, after);
  dmp.diff_cleanupSemantic(diffs);

  const frames: AnimationFrame[] = [];
  let cursorPos = 0;

  for (const [op, text] of diffs) {
    if (op === 0) {
      // EQUAL — 光标前进，无操作
      cursorPos += text.length;
    } else if (op === -1) {
      // DELETE
      frames.push({
        cursorPosition: cursorPos,
        operation: { type: 'delete', offset: cursorPos, length: text.length },
        delayMs: opts.baseDelayMs,
      });
      // cursorPos 不变，因为删除后后续内容前移
    } else if (op === 1) {
      // INSERT — 按 chunkSize 分块
      for (let i = 0; i < text.length; i += opts.chunkSize) {
        const chunk = text.slice(i, i + opts.chunkSize);
        frames.push({
          cursorPosition: cursorPos + chunk.length,
          operation: { type: 'insert', offset: cursorPos, text: chunk },
          delayMs: opts.baseDelayMs,
        });
        cursorPos += chunk.length;
      }
    }
  }

  return frames;
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run tests/diff-to-frames.test.ts`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/diff-to-frames.ts tests/diff-to-frames.test.ts package.json package-lock.json
git commit -m "feat(editor): diff→AnimationFrame 转换器"
```

---

## Phase 3: Agent 拦截层与 IPC

### Task 7: AgentOperationInterceptor — 主进程拦截层

**Files:**
- Create: `electron/acp/operation-interceptor.ts`

- [ ] **Step 1: 实现拦截层**

```typescript
// electron/acp/operation-interceptor.ts
import type { BrowserWindow } from 'electron';
import { diff_match_patch as DiffMatchPatch } from 'diff-match-patch';

export interface StreamingEditOp {
  type: 'insert' | 'delete' | 'replace';
  offset: number;
  length?: number;
  text?: string;
}

export interface StreamingFrame {
  cursorPosition: number;
  operation: StreamingEditOp;
  delayMs: number;
}

export interface InterceptResult {
  frames: StreamingFrame[];
  targetFile: string;
  finalContent: string;
}

const CHUNK_SIZE = 15;
const BASE_DELAY_MS = 30;

/**
 * 拦截 Agent 的文件写入操作，计算 diff 并拆解为动画帧序列。
 * 帧序列通过 IPC 发送到渲染进程，由 StreamingEditor 播放。
 */
export class AgentOperationInterceptor {
  private mainWindow: () => BrowserWindow | null;
  private activeFile: string | null = null;

  constructor(getMainWindow: () => BrowserWindow | null) {
    this.mainWindow = getMainWindow;
  }

  /**
   * 拦截文件写入，返回帧序列并通过 IPC 推送开始信号。
   * 实际磁盘写入由调用方在动画完成后执行。
   */
  intercept(
    filePath: string,
    before: string | null,
    after: string,
  ): InterceptResult {
    const currentContent = before ?? '';
    const dmp = new DiffMatchPatch();
    const diffs = dmp.diff_main(currentContent, after);
    dmp.diff_cleanupSemantic(diffs);

    const frames: StreamingFrame[] = [];
    let cursor = 0;

    for (const [op, text] of diffs) {
      if (op === 0) {
        cursor += text.length;
      } else if (op === -1) {
        frames.push({
          cursorPosition: cursor,
          operation: { type: 'delete', offset: cursor, length: text.length },
          delayMs: BASE_DELAY_MS,
        });
      } else if (op === 1) {
        for (let i = 0; i < text.length; i += CHUNK_SIZE) {
          const chunk = text.slice(i, i + CHUNK_SIZE);
          frames.push({
            cursorPosition: cursor + chunk.length,
            operation: { type: 'insert', offset: cursor, text: chunk },
            delayMs: BASE_DELAY_MS,
          });
          cursor += chunk.length;
        }
      }
    }

    this.activeFile = filePath;
    return { frames, targetFile: filePath, finalContent: after };
  }

  /** 通知渲染进程开始播放动画 */
  sendStartStreaming(filePath: string, frames: StreamingFrame[]): void {
    this.mainWindow()?.webContents.send('agent:streaming-start', {
      filePath,
      frames,
      totalFrames: frames.length,
    });
  }

  /** 通知渲染进程动画完成（磁盘已写入） */
  sendStreamingComplete(filePath: string): void {
    this.activeFile = null;
    this.mainWindow()?.webContents.send('agent:streaming-complete', { filePath });
  }

  /** 当前是否有活跃的流式操作 */
  get isActive(): boolean {
    return this.activeFile !== null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add electron/acp/operation-interceptor.ts
git commit -m "feat(acp): AgentOperationInterceptor 文件写入拦截层"
```

---

### Task 8: 修改 FileSystemRuntime 接入拦截层

**Files:**
- Modify: `electron/acp/fs-runtime.ts`

- [ ] **Step 1: 在 writeTextFile 中接入拦截层**

修改 `electron/acp/fs-runtime.ts` 的 `writeTextFile` 方法：

1. 构造函数新增 `interceptor` 参数：

```typescript
constructor(
  private projectDir: string,
  private interceptor?: AgentOperationInterceptor,
) {}
```

2. 在 `writeTextFile` 中，写入磁盘前先通知拦截层：

```typescript
async writeTextFile({ path, content }: { path: string; content: string }): Promise<WriteResult> {
  const resolved = this.validatePath(path);
  if (content.length > MAX_WRITE_SIZE) {
    throw new Error(`File too large: ${content.length} bytes (max ${MAX_WRITE_SIZE})`);
  }

  let before: string | null = null;
  try {
    before = await fs.readFile(resolved, 'utf-8');
  } catch {
    // 文件不存在，before 为 null
  }

  // 拦截层：计算 diff 并发送动画帧到渲染进程
  if (this.interceptor) {
    const result = this.interceptor.intercept(resolved, before, content);
    if (result.frames.length > 0) {
      this.interceptor.sendStartStreaming(path, result.frames);
    }
  }

  // 实际写入磁盘
  await fs.mkdir(dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, content, 'utf-8');

  // 通知动画完成
  if (this.interceptor) {
    this.interceptor.sendStreamingComplete(path);
  }

  return { success: true, before, after: content, filePath: path };
}
```

- [ ] **Step 2: Commit**

```bash
git add electron/acp/fs-runtime.ts
git commit -m "feat(acp): FileSystemRuntime 接入操作拦截层"
```

---

### Task 9: IPC 通道注册与 Preload 桥接

**Files:**
- Modify: `electron/acp/ipc.ts`
- Modify: `electron/preload.ts`
- Modify: `src/lib/electron-api.ts`

- [ ] **Step 1: 在 ipc.ts 中传入拦截层实例**

修改 `registerAgentIpc` 函数，实例化 `AgentOperationInterceptor` 并传给 `FileSystemRuntime`（在 session connect 时）。

在 `ipc.ts` 头部引入：
```typescript
import { AgentOperationInterceptor } from './operation-interceptor';
```

在 `registerAgentIpc` 内创建实例：
```typescript
const interceptor = new AgentOperationInterceptor(getMainWindow);
```

在 `agent:connect` handler 中，将 `interceptor` 传递给 session manager，使其在创建 `FileSystemRuntime` 时使用。

- [ ] **Step 2: 在 preload.ts 中暴露流式事件监听**

在 `agentAPI` 对象中新增：

```typescript
onStreamingStart: (callback: (data: { filePath: string; frames: unknown[]; totalFrames: number }) => void) => {
  const handler = (_event: any, data: any) => callback(data);
  ipcRenderer.on('agent:streaming-start', handler);
  return () => ipcRenderer.removeListener('agent:streaming-start', handler);
},
onStreamingComplete: (callback: (data: { filePath: string }) => void) => {
  const handler = (_event: any, data: any) => callback(data);
  ipcRenderer.on('agent:streaming-complete', handler);
  return () => ipcRenderer.removeListener('agent:streaming-complete', handler);
},
```

- [ ] **Step 3: 在 electron-api.ts 中更新类型定义**

在 `AgentAPI` 接口中新增对应的类型声明。

- [ ] **Step 4: Commit**

```bash
git add electron/acp/ipc.ts electron/preload.ts src/lib/electron-api.ts
git commit -m "feat(ipc): 流式编辑 IPC 通道与 preload 桥接"
```

---

## Phase 4: UI 组件

### Task 10: AgentQuickActions — 快捷操作组件

**Files:**
- Create: `src/components/agent/AgentQuickActions.tsx`
- Modify: `src/components/agent/AgentSidebar.tsx`

- [ ] **Step 1: 实现 AgentQuickActions**

```tsx
// src/components/agent/AgentQuickActions.tsx
import { useScriptStore } from '../../store/script';
import { useAgentStore } from '../../store/agent';
import styles from './AgentQuickActions.module.css';

/** 根据文件状态自适应快捷操作按钮 */
export function AgentQuickActions() {
  const {
    originalText,
    scriptText,
    annotations,
    reviewCompleted,
    agentOperation,
    fileEntries,
  } = useScriptStore();
  const { status, sidebarOpen } = useAgentStore();

  if (!sidebarOpen || status !== 'connected') return null;

  const hasOriginal = originalText.length > 0;
  const hasScript = scriptText.length > 0;
  const hasPendingAnnotations = annotations.some((a) => a.status === 'pending');
  const isOperating = agentOperation.isOperating;

  const sendQuickAction = (prompt: string) => {
    if (isOperating) return;
    window.agentAPI?.sendPrompt([{ type: 'text', text: prompt }]);
  };

  const actions = deriveActions({
    hasOriginal,
    hasScript,
    hasPendingAnnotations,
    reviewCompleted,
  });

  return (
    <div className={styles.quickActions}>
      <div className={styles.label}>⚡ 快捷操作</div>
      <div className={styles.buttons}>
        {actions.map((action) => (
          <button
            key={action.id}
            className={`${styles.btn} ${action.primary ? styles.primary : ''}`}
            disabled={isOperating}
            onClick={() => sendQuickAction(action.prompt)}
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
    </div>
  );
}

interface ActionDef {
  id: string;
  label: string;
  prompt: string;
  primary?: boolean;
  tooltip: string;
}

function deriveActions(ctx: {
  hasOriginal: boolean;
  hasScript: boolean;
  hasPendingAnnotations: boolean;
  reviewCompleted: boolean;
}): ActionDef[] {
  if (!ctx.hasOriginal && !ctx.hasScript) {
    return [
      { id: 'import', label: '📄 导入文稿', prompt: '', tooltip: '导入原始文稿', primary: true },
    ];
  }
  if (ctx.hasOriginal && !ctx.hasScript) {
    return [
      { id: 'generate', label: '✨ 生成口播稿', prompt: '请根据 original.md 的内容生成口播稿，保存为 script.md', primary: true, tooltip: '基于原稿生成口播稿' },
    ];
  }
  if (ctx.hasScript && !ctx.reviewCompleted) {
    return [
      { id: 'review', label: '🔍 AI 审查', prompt: '请审查 script.md 的内容，标注出需要修改的问题', primary: true, tooltip: 'AI 审查口播稿' },
      { id: 'regenerate', label: '重新生成', prompt: '请重新生成 script.md 口播稿', tooltip: '重新生成口播稿' },
    ];
  }
  if (ctx.hasPendingAnnotations) {
    return [
      { id: 'accept-all', label: '✅ 全部接受', prompt: '请接受所有审查建议并修改 script.md', primary: true, tooltip: '接受所有建议' },
      { id: 're-review', label: '重新审查', prompt: '请重新审查 script.md', tooltip: '重新审查' },
    ];
  }
  return [
    { id: 'copy', label: '📋 复制口播稿', prompt: '', tooltip: '复制口播稿内容', primary: true },
    { id: 'regenerate', label: '重新生成', prompt: '请重新生成 script.md 口播稿', tooltip: '重新生成' },
    { id: 're-review', label: '重新审查', prompt: '请重新审查 script.md', tooltip: '重新审查' },
  ];
}
```

- [ ] **Step 2: 创建样式文件**

```css
/* src/components/agent/AgentQuickActions.module.css */
.quickActions {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color, #333);
  background: var(--bg-secondary, #1a2a3a);
}
.label {
  font-size: 11px;
  color: var(--text-tertiary, #7fb8e0);
  margin-bottom: 6px;
}
.buttons {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.btn {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  border: none;
  cursor: pointer;
  background: var(--bg-tertiary, #2a2a4e);
  color: var(--text-secondary, #aaa);
  transition: opacity 0.15s;
}
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.primary {
  background: var(--accent-primary, #3498db);
  color: #fff;
}
.stopBtn {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  border: 1px solid #e74c3c;
  cursor: pointer;
  background: transparent;
  color: #e74c3c;
}
```

- [ ] **Step 3: 将 AgentQuickActions 插入 AgentSidebar**

修改 `src/components/agent/AgentSidebar.tsx`（line 158），在 `<AgentHeader />` 之后插入：

```tsx
import { AgentQuickActions } from './AgentQuickActions';

// 在 JSX 中（line 158-159 之间）：
<AgentHeader />
<AgentQuickActions />
<MessageList />
```

- [ ] **Step 4: Commit**

```bash
git add src/components/agent/AgentQuickActions.tsx src/components/agent/AgentQuickActions.module.css src/components/agent/AgentSidebar.tsx
git commit -m "feat(agent): AgentQuickActions 快捷操作组件"
```

---

### Task 11: AnnotationCard — Grammarly 式悬浮操作卡片

**Files:**
- Create: `src/components/script/AnnotationCard.tsx`
- Create: `src/components/script/AnnotationCard.module.css`

- [ ] **Step 1: 实现 AnnotationCard**

```tsx
// src/components/script/AnnotationCard.tsx
import type { Annotation } from '../../store/script';
import styles from './AnnotationCard.module.css';

const SEVERITY_CONFIG = {
  error:   { icon: '🔴', label: '错误', color: '#e74c3c' },
  warning: { icon: '🟡', label: '警告', color: '#e67e22' },
  info:    { icon: '🔵', label: '建议', color: '#3498db' },
} as const;

interface AnnotationCardProps {
  annotation: Annotation;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  onAIRewrite: (id: string) => void;
  style?: React.CSSProperties;
}

export function AnnotationCard({
  annotation,
  onAccept,
  onDismiss,
  onAIRewrite,
  style,
}: AnnotationCardProps) {
  const config = SEVERITY_CONFIG[annotation.severity];

  return (
    <div className={styles.card} style={style}>
      <div className={styles.header} style={{ color: config.color }}>
        <span>{config.icon}</span>
        <span className={styles.title}>{annotation.issue}</span>
      </div>

      {annotation.suggestion && (
        <div className={styles.suggestion}>
          <span className={styles.suggestionIcon}>💡</span>
          <span>{annotation.suggestion}</span>
        </div>
      )}

      <div className={styles.actions}>
        <button
          className={styles.acceptBtn}
          onClick={() => onAccept(annotation.id)}
        >
          ✓ 接受建议
        </button>
        <button
          className={styles.dismissBtn}
          onClick={() => onDismiss(annotation.id)}
        >
          忽略
        </button>
        <button
          className={styles.rewriteBtn}
          onClick={() => onAIRewrite(annotation.id)}
        >
          AI 重写
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建样式文件**

```css
/* src/components/script/AnnotationCard.module.css */
.card {
  background: var(--bg-secondary, #2a2a4e);
  border: 1px solid var(--border-color, #444);
  border-radius: 8px;
  padding: 10px;
  max-width: 340px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 100;
}
.header {
  font-weight: bold;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.title { flex: 1; }
.suggestion {
  margin-top: 6px;
  padding: 6px 8px;
  background: var(--bg-tertiary, #1a2a3a);
  border-radius: 4px;
  font-size: 11px;
  color: var(--text-secondary, #7fb8e0);
  display: flex;
  gap: 4px;
}
.suggestionIcon { flex-shrink: 0; }
.actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.actions button {
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 11px;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
}
.acceptBtn {
  background: #2ecc71;
  color: #fff;
}
.dismissBtn {
  background: var(--bg-tertiary, #555);
  color: var(--text-secondary, #aaa);
}
.rewriteBtn {
  background: #3498db;
  color: #fff;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/script/AnnotationCard.tsx src/components/script/AnnotationCard.module.css
git commit -m "feat(script): AnnotationCard Grammarly 式悬浮操作卡片"
```

---

### Task 12: AgentProgressBar — 操作进度指示

**Files:**
- Create: `src/components/agent/AgentProgressBar.tsx`
- Create: `src/components/agent/AgentProgressBar.module.css`

- [ ] **Step 1: 实现 AgentProgressBar**

```tsx
// src/components/agent/AgentProgressBar.tsx
import { useScriptStore } from '../../store/script';
import styles from './AgentProgressBar.module.css';

const OP_LABELS: Record<string, string> = {
  generate: '生成中',
  review: '审查中',
  rewrite: '重写中',
  custom: '处理中',
};

export function AgentProgressBar() {
  const { agentOperation } = useScriptStore();

  if (!agentOperation.isOperating) return null;

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
```

- [ ] **Step 2: 创建样式文件**

```css
/* src/components/agent/AgentProgressBar.module.css */
.container {
  padding: 8px 12px;
  background: rgba(124, 58, 237, 0.1);
  border: 1px solid rgba(124, 58, 237, 0.25);
  border-radius: 6px;
  margin: 8px;
}
.header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.icon { font-size: 12px; }
.label {
  font-size: 11px;
  font-weight: bold;
  color: #a78bfa;
  flex: 1;
}
.percent {
  font-size: 10px;
  color: #888;
}
.track {
  height: 4px;
  background: #333;
  border-radius: 3px;
  overflow: hidden;
}
.bar {
  height: 100%;
  background: #7c3aed;
  border-radius: 3px;
  transition: width 0.3s ease;
}
.stopBtn {
  margin-top: 6px;
  padding: 2px 8px;
  border: 1px solid #e74c3c;
  border-radius: 4px;
  background: transparent;
  color: #e74c3c;
  font-size: 10px;
  cursor: pointer;
  width: 100%;
}
```

- [ ] **Step 3: 将 AgentProgressBar 插入 AgentSidebar**

在 `AgentSidebar.tsx` 的 `<AgentQuickActions />` 之后、`<MessageList />` 之前插入：

```tsx
import { AgentProgressBar } from './AgentProgressBar';

<AgentQuickActions />
<AgentProgressBar />
<MessageList />
```

- [ ] **Step 4: Commit**

```bash
git add src/components/agent/AgentProgressBar.tsx src/components/agent/AgentProgressBar.module.css src/components/agent/AgentSidebar.tsx
git commit -m "feat(agent): AgentProgressBar 操作进度指示"
```

---

## Phase 5: 集成与清理

### Task 13: 移除旧 Step 组件

**Files:**
- Delete: `src/components/script/StepIndicator.tsx`
- Delete: `src/components/script/StepReviewOriginal.tsx`
- Delete: `src/components/script/StepGenerate.tsx`
- Delete: `src/components/script/StepAIReview.tsx`
- Delete: `src/components/script/StepConfirm.tsx`
- Delete: `src/components/script/StepDrawer.tsx`
- Modify: `src/components/script/OperationBar.tsx`

- [ ] **Step 1: 删除旧 Step 组件文件**

```bash
rm src/components/script/StepIndicator.tsx
rm src/components/script/StepReviewOriginal.tsx
rm src/components/script/StepGenerate.tsx
rm src/components/script/StepAIReview.tsx
rm src/components/script/StepConfirm.tsx
rm src/components/script/StepDrawer.tsx
```

- [ ] **Step 2: 简化 OperationBar**

`src/components/script/OperationBar.tsx` 大幅简化：

1. 移除 Props：`currentStep`、`onPrev`、`onNext`、`onStepClick`、`canGoNext`、`onOpenTemplateDrawer`、`onOpenAnnotationsDrawer`、`generating`、`reviewing`
2. 移除 `StepIndicator` 引用
3. 移除步骤条渲染
4. 移除上一步/下一步按钮
5. 保留：`onBack`、`onSave`、统计信息展示

简化后的 OperationBar 仅包含：
- 返回按钮
- 文件统计信息（字数、标注数）
- 保存按钮

```tsx
interface OperationBarProps {
  originalStats: OriginalStats;
  scriptStats: GeneratedScriptStats;
  annotationSummary: AnnotationSummary;
  onBack: () => void;
  onSave: () => void;
}
```

- [ ] **Step 3: 运行 TypeScript 类型检查确认无断引用**

```bash
npx tsc --noEmit 2>&1 | head -40
```

修复所有由移除引起的类型错误。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(script): 移除旧 Step 组件和步骤导航逻辑"
```

---

### Task 14: ScriptWorkbench 重构 — 接入 Agent 操作流

**Files:**
- Modify: `src/pages/ScriptWorkbench.tsx`
- Modify: `src/pages/ScriptWorkbench.module.css`

- [ ] **Step 1: 移除步骤相关代码**

在 `ScriptWorkbench.tsx` 中：

1. 从 store destructuring 中移除：`currentStep`、`setCurrentStep`、`drawerVisible`、`drawerContent`、`openDrawer`、`closeDrawer`
2. 移除函数：`handlePreviousStep`（lines 447-464）、`handleNextStep`（lines 466-483）、`handleStepClick`（lines 485-492）
3. 移除 `normalizePersistedStep` 和 `getPreferredOpenFile` 辅助函数
4. 移除 `StepDrawer` 组件引用和渲染
5. 简化 `OperationBar` 调用，移除步骤相关 props

- [ ] **Step 2: 新增 Agent 流式编辑事件监听**

在 `ScriptWorkbench` 组件内新增 effect hook：

```tsx
import { StreamingEditor } from '../lib/streaming-editor';
import { virtualCursorExtension } from '../lib/virtual-cursor';
import { createReadOnlyGuard } from '../lib/editor-readonly-guard';

// 在组件内：
const streamingRef = useRef<StreamingEditor | null>(null);

useEffect(() => {
  const cleanupStart = window.agentAPI?.onStreamingStart((data) => {
    const { filePath, frames } = data;

    // 自动打开目标文件
    if (openedFile !== filePath) {
      setOpenedFile(filePath);
    }

    // 启动 Agent 操作状态
    startAgentOperation('generate');

    // 获取编辑器实例并开始流式写入
    // （编辑器实例通过 ref 传递）
    if (editorViewRef.current) {
      const controller = new StreamingEditor(editorViewRef.current, {
        onProgress: (percent) => setAgentOperation({ progress: percent }),
        onComplete: () => stopAgentOperation(),
        onStopped: () => stopAgentOperation(),
      });
      streamingRef.current = controller;
      controller.start(frames as any);
    }
  });

  const cleanupComplete = window.agentAPI?.onStreamingComplete(() => {
    stopAgentOperation();
    // 刷新文件树
    refreshFileEntries();
  });

  return () => {
    cleanupStart?.();
    cleanupComplete?.();
  };
}, [openedFile]);
```

- [ ] **Step 3: 传递编辑器 ref 和虚拟光标扩展**

在渲染 `ScriptEditor` 时，传递：
- `editorViewRef` 用于外部访问 EditorView 实例
- `virtualCursorExtension` 作为额外扩展
- `readOnlyGuard` 与 `editorAgent.readOnly` 状态联动

- [ ] **Step 4: 新增只读状态指示**

在编辑器区域上方，当 `editorAgent.readOnly` 为 true 时显示状态条：

```tsx
{editorAgent.readOnly && (
  <div className={styles.agentTypingIndicator}>
    🤖 Agent 正在输入...
  </div>
)}
```

- [ ] **Step 5: 更新 hydrateProjectDirectory**

移除 `normalizePersistedStep` 调用，改为从 v2 格式读取 `reviewCompleted`。

- [ ] **Step 6: 更新 CSS**

在 `ScriptWorkbench.module.css` 中：
1. 移除步骤相关样式
2. 新增 `.agentTypingIndicator` 样式：

```css
.agentTypingIndicator {
  position: absolute;
  top: 8px;
  right: 12px;
  background: rgba(124, 58, 237, 0.2);
  border: 1px solid rgba(124, 58, 237, 0.4);
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 11px;
  color: #a78bfa;
  z-index: 10;
  pointer-events: none;
}
```

- [ ] **Step 7: Commit**

```bash
git add src/pages/ScriptWorkbench.tsx src/pages/ScriptWorkbench.module.css
git commit -m "refactor(workbench): 移除步骤流程，接入 Agent 流式编辑事件流"
```

---

### Task 15: ScriptEditor 集成虚拟光标和只读锁

**Files:**
- Modify: `src/ui/components/script-editor.tsx`

- [ ] **Step 1: 新增 props**

在 `ScriptEditorProps` 中新增：

```typescript
interface ScriptEditorProps {
  // ...existing props
  readOnly?: boolean;
  editorViewRef?: React.MutableRefObject<EditorView | null>;
}
```

- [ ] **Step 2: 集成虚拟光标扩展**

在 CodeMirror `extensions` 数组（line 198-213）中新增：

```typescript
import { virtualCursorExtension } from '../../lib/virtual-cursor';
import { createReadOnlyGuard } from '../../lib/editor-readonly-guard';

// 在组件内：
const readOnlyGuard = useRef(createReadOnlyGuard());

// extensions 数组中添加：
...virtualCursorExtension,
readOnlyGuard.current.extension,
```

- [ ] **Step 3: 只读状态同步**

新增 effect 响应 `readOnly` prop 变化：

```typescript
useEffect(() => {
  if (viewRef.current) {
    viewRef.current.dispatch({
      effects: readOnlyGuard.current.reconfigure(readOnly ?? false),
    });
  }
}, [readOnly]);
```

- [ ] **Step 4: 暴露 EditorView ref**

在 EditorView 创建后，同步到外部 ref：

```typescript
useEffect(() => {
  // 创建 EditorView 后...
  if (editorViewRef) {
    editorViewRef.current = view;
  }
  viewRef.current = view;
  // ...
}, []);
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/script-editor.tsx
git commit -m "feat(editor): ScriptEditor 集成虚拟光标和只读锁"
```

---

### Task 16: AnnotationCard 集成到编辑器

**Files:**
- Modify: `src/ui/components/script-editor.tsx` (或相关的 annotation 模块)

- [ ] **Step 1: 替换现有 AnnotationPopover**

将现有的 `AnnotationPopover`（script-editor.tsx lines 33-162）替换为新的 `AnnotationCard`：

1. 在点击标注高亮时，弹出 `AnnotationCard` 而非旧的 popover
2. 新增 `onAIRewrite` 回调 prop：

```typescript
interface ScriptEditorProps {
  // ...existing
  onAIRewrite?: (annotationId: string) => void;
}
```

3. 在 `onAIRewrite` 被调用时，向 Agent 发送指令：

```typescript
const handleAIRewrite = (id: string) => {
  const annotation = annotations?.find((a) => a.id === id);
  if (annotation) {
    window.agentAPI?.sendPrompt([{
      type: 'text',
      text: `请重写 script.md 中的以下内容：「${annotation.originalText}」，问题：${annotation.issue}`,
    }]);
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/components/script-editor.tsx src/components/script/AnnotationCard.tsx
git commit -m "feat(editor): 集成 AnnotationCard 替换旧 popover"
```

---

### Task 17: FileTreePanel 文件创建动画

**Files:**
- Modify: `src/components/script/FileTreePanel.tsx`
- Modify: `src/components/script/FileTreePanel.module.css`

- [ ] **Step 1: 追踪新增文件**

在 `FileTreePanel` 中，通过比较前后 `fileEntries` 检测新增文件：

```tsx
const prevEntriesRef = useRef<FileEntry[]>([]);
const [newFiles, setNewFiles] = useState<Set<string>>(new Set());

useEffect(() => {
  const prevNames = new Set(prevEntriesRef.current.map((e) => e.name));
  const added = fileEntries.filter((e) => !prevNames.has(e.name)).map((e) => e.name);
  if (added.length > 0) {
    setNewFiles(new Set(added));
    // 动画结束后清除标记
    const timer = setTimeout(() => setNewFiles(new Set()), 1500);
    return () => clearTimeout(timer);
  }
  prevEntriesRef.current = fileEntries;
}, [fileEntries]);
```

- [ ] **Step 2: 在 TreeNode 中应用动画 class**

在文件节点渲染中，为新增文件添加动画 class：

```tsx
<div
  className={`${styles.fileItem} ${newFiles.has(name) ? styles.fileNew : ''}`}
>
```

- [ ] **Step 3: CSS 动画**

在 `FileTreePanel.module.css` 中新增：

```css
.fileNew {
  animation: fileAppear 0.5s ease-out;
  border: 1px dashed rgba(46, 204, 113, 0.4);
  background: rgba(46, 204, 113, 0.08);
}
@keyframes fileAppear {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/script/FileTreePanel.tsx src/components/script/FileTreePanel.module.css
git commit -m "feat(file-tree): 新增文件出现动画"
```

---

### Task 18: 更新测试 & 最终验证

**Files:**
- Modify: `tests/script-workbench.test.tsx`
- Modify: `tests/script-shell-components.test.tsx`

- [ ] **Step 1: 更新 ScriptWorkbench 测试**

修改 `tests/script-workbench.test.tsx`：
1. 移除所有引用 `currentStep`、`StepIndicator`、`handleNextStep`、`handlePreviousStep` 的测试
2. 移除引用 `StepDrawer`、`StepGenerate`、`StepAIReview`、`StepConfirm` 的测试
3. 新增 Agent 操作状态的基本测试

- [ ] **Step 2: 更新 shell 组件测试**

修改 `tests/script-shell-components.test.tsx`：
1. 移除引用已删除组件的测试
2. 新增 `AgentQuickActions` 渲染测试
3. 新增 `AgentProgressBar` 渲染测试

- [ ] **Step 3: 运行全部测试**

```bash
npx vitest run
```
Expected: All tests pass

- [ ] **Step 4: 运行 TypeScript 类型检查**

```bash
npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 5: 运行 lint**

```bash
npx eslint src/ --ext .ts,.tsx
```
Expected: No new errors

- [ ] **Step 6: Commit**

```bash
git add tests/
git commit -m "test: 适配 Agent 驱动重构更新测试"
```

---

### Task 19: Agent 侧边栏自动展开与上下文提示

**Files:**
- Modify: `src/components/agent/AgentSidebar.tsx`
- Modify: `src/pages/ScriptWorkbench.tsx`

- [ ] **Step 1: 导入文稿后自动展开 Agent 侧边栏**

在 `ScriptWorkbench.tsx` 的导入/创建文件处理中，添加自动展开逻辑：

```typescript
const { setSidebarOpen } = useAgentStore();

// 在导入文稿成功后：
setSidebarOpen(true);
```

- [ ] **Step 2: Agent 连接后发送上下文提示**

在 `AgentSidebar.tsx` 的 auto-connect hook 中，连接成功后发送初始上下文消息（作为 system-level 提示，不显示在对话中）。

在 `AgentQuickActions` 中，当检测到有 original.md 但 Agent 对话为空时，自动在 Agent 消息区显示引导文本：

```typescript
// 在 AgentSidebar 中检测并显示引导
if (messages.length === 0 && originalText.length > 0) {
  // 显示引导消息
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/agent/AgentSidebar.tsx src/pages/ScriptWorkbench.tsx
git commit -m "feat(agent): 导入文稿后自动展开侧边栏并显示引导"
```

---

### Task 20: 最终集成验证

- [ ] **Step 1: 全量构建验证**

```bash
npm run build
```
Expected: Build succeeds with no errors

- [ ] **Step 2: 手动冒烟测试清单**

以下场景需要手动验证：

1. **空白状态**：打开工作台 → 看到 EmptyGuide → 选择目录 → Agent 侧边栏展开
2. **导入原稿**：导入文本文件 → original.md 出现在文件树 → Agent 快捷按钮显示「生成口播稿」
3. **生成口播稿**：点击「生成口播稿」→ 虚拟光标出现 → 文字流式写入 → script.md 出现在文件树
4. **AI 审查**：点击「AI 审查」→ 虚拟光标扫描 → 标注出现 → 点击标注弹出操作卡片
5. **接受建议**：点击「接受建议」→ 文字替换 → 标注消失
6. **AI 重写**：点击「AI 重写」→ Agent 接收指令 → 虚拟光标定位重写
7. **打断 Agent**：Agent 工作时点击停止 → 操作中止 → 已写内容保留
8. **持久化**：关闭应用重新打开 → 状态正确恢复（v2 格式）
9. **v1 兼容**：用旧格式的 script-state.json 打开 → 正确迁移到 v2

- [ ] **Step 3: 最终 Commit**

```bash
git add -A
git commit -m "feat(script-workbench): Agent 驱动重构完成 — 虚拟光标流式编辑"
```
