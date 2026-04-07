# 脚本工作台 Agent 驱动重构设计

> **日期**: 2026-04-07
> **状态**: 已确认
> **前置**: `2026-04-07-agent-acp-integration-design.md`, `2026-04-07-script-workbench-file-tree-refactor-design.md`

## 1. 目标

将脚本工作台从「强制 4 步线性流程 + Agent 割裂」重构为「Agent 驱动 + 轻量引导 + 实时可视化协作」模式，让用户通过 AI Agent 快速生成、审查、编辑稿件，并在编辑器中实时看到 Agent 的操作过程。

### 核心设计原则

- **Agent 是唯一执行引擎**：所有 AI 操作（生成、审查、重写）统一通过 ACP Agent 执行
- **文件树是唯一产出展示区**：Agent 生成的文件直接出现在文件树中
- **编辑器保持干净**：标注只在审查后出现，无额外 UI 噪音
- **操作透明可见**：虚拟光标 + 流式编辑让用户看到 Agent 在工作

## 2. 设计决策汇总

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 交互模式 | 混合模式：Agent 驱动 + 轻量引导 | 新手有引导，老手可自由探索 |
| 引导位置 | Agent 侧边栏顶部快捷操作 | 操作统一到 Agent 侧，编辑区保持干净 |
| 审查标注 | 内联高亮 + 悬浮操作卡片（Grammarly 式） | 就地操作，不打断编辑流 |
| Agent 可视化 | 虚拟光标 + 流式编辑 + 动态标记 | 核心差异化体验，一步到位 |
| 用户控制 | Agent 操作时编辑器只读，可打断/追加指令 | 简洁可靠，避免并发编辑冲突 |

## 3. 架构概览

### 3.1 数据流

```
用户操作（快捷按钮 / 自然语言 / 直接编辑）
        ↓
   Agent 侧边栏（理解意图、执行操作、智能提示）
        ↓
   ACP FileSystemRuntime
        ↓
   AgentOperationInterceptor（拦截层）
   ├── diff 计算变更区域
   ├── 拆分为动画帧序列
   ├── 计算光标移动路径
   └── 编排插入/删除/标记时序
        ↓
   编辑器（虚拟光标动画 → 流式写入 → 滚动跟随）
        ↓
   文件系统（最终持久化）
```

### 3.2 布局结构

```
┌──────────────────────────────────────────────────────┐
│                    应用顶部栏                         │
├────────┬───────────────────────────┬─────────────────┤
│        │        FileTabs           │  ⚡ 快捷操作     │
│  文件树 ├───────────────────────────┤  ┌──────────┐   │
│        │                           │  │生成口播稿│   │
│ 📁 项目│     编辑器（主工作区）       │  │AI 审查  │   │
│ ├ orig │                           │  │重新生成  │   │
│ └ scrip│   虚拟光标 + 内联标注       │  └──────────┘   │
│        │                           │                 │
│        │   [悬浮操作卡片]           │  🤖 Agent 对话   │
│        │                           │  消息列表...     │
│        │                           │                 │
│        │                           │  [输入框]       │
├────────┴───────────────────────────┴─────────────────┤
│                    状态栏                             │
└──────────────────────────────────────────────────────┘
```

## 4. 组件设计

### 4.1 AgentQuickActions — 快捷操作区

位于 Agent 侧边栏顶部，根据当前文件状态**自适应**显示可用操作。

**状态感知规则：**

| 文件状态 | 可用快捷按钮 |
|----------|-------------|
| 无文件 | `导入文稿`、`新建空白` |
| 有 original.md，无 script.md | `✨ 生成口播稿`（高亮主操作） |
| 有 script.md，未审查 | `🔍 AI 审查`（高亮）、`重新生成` |
| 有 script.md，有标注未处理 | `✅ 全部接受`、`重新审查` |
| 所有标注已处理 | `📋 复制口播稿`、`重新生成`、`重新审查` |

**模板选择：**
- 旧设计中的模板选择抽屉（StepDrawer）移除
- 默认使用上次保存的模板（或内置 `news-broadcast`）
- 用户可通过自然语言指定模板：「用轻松口语风格生成」「换一个正式新闻模板」
- Agent 理解意图后自动匹配或推荐合适的模板

**交互行为：**
- 点击快捷按钮 = 向 Agent 发送预设指令（如 `"请根据 original.md 生成口播稿"`)
- Agent 接收指令后开始执行，触发虚拟光标 + 流式编辑
- 按钮在 Agent 工作时置灰，显示停止按钮

### 4.2 AgentOperationInterceptor — 操作拦截层

**核心模块**，位于 ACP `FileSystemRuntime` 和实际文件写入之间。

**职责：**
1. 拦截 Agent 的 `write_file` 操作
2. 对比当前文件内容和目标内容，计算 diff
3. 将 diff 拆解为有序的编辑操作序列（insert/delete/replace）
4. 为每个操作计算虚拟光标的目标位置
5. 按时序逐步通过 `editor.dispatch()` 应用到 CodeMirror
6. 全部应用完成后，写入磁盘持久化

**拦截点：** `electron/acp/fs-runtime.ts` 的 `handleWriteFile` 方法。在现有 IPC 通道 `save-script-file` 之前插入，通过新的 IPC 事件 `agent-streaming-edit` 向渲染进程逐步推送编辑操作。

**关键接口：**

```typescript
// 拦截层产出的编辑操作序列
interface StreamingEditOperation {
  type: 'insert' | 'delete' | 'replace' | 'annotate'
  offset: number        // 编辑器中的字符偏移
  length?: number       // delete/replace 时的原文长度
  text?: string         // insert/replace 时的新文本
  annotation?: Annotation  // annotate 时的标注信息
}

// 拦截层产出的动画帧
interface AnimationFrame {
  cursorPosition: number           // 虚拟光标目标位置
  operation: StreamingEditOperation  // 要执行的编辑操作
  delayMs: number                  // 与上一帧的间隔（毫秒）
}

// 拦截层控制器
interface InterceptorController {
  start(frames: AnimationFrame[]): void
  pause(): void
  resume(): void
  stop(): void          // 停止并保留已执行内容
  abort(): void         // 停止并回滚
  onProgress: (percent: number) => void
  onComplete: () => void
}
```

### 4.3 VirtualCursor — 虚拟光标

CodeMirror 装饰层，表示 Agent 当前的操作位置。

**视觉表现：**
- 紫色竖线光标（`#a78bfa`），2px 宽，高度与行高一致
- 光标顶部有小标签 `🤖`，表示这是 Agent 的光标
- 移动时有平滑过渡动画（CSS transition，约 150ms）
- 光标闪烁动画（类似真实光标的 blink）

**实现方式：** CodeMirror 6 的 `Decoration.widget`，通过 `StateField` 管理光标位置状态，通过 `EditorView.dispatch` 更新位置。

### 4.4 StreamingEditor — 流式写入控制器

协调虚拟光标移动和文本写入的时序。

**写入速度策略：**
- 基础速度：30-50 字/秒（模拟快速打字）
- 大段内容（>200字）：加速到 100-150 字/秒，避免用户等太久
- 标记操作（annotate）：每个标记间暂停 300ms，让用户看清
- 用户可通过 Agent 侧边栏调速（快速/正常/详细）

**滚动跟随：** 编辑器视口自动跟随虚拟光标，保持光标在可视区域内，使用 `scrollIntoView` 并带平滑滚动。

### 4.5 AnnotationCard — 悬浮标注操作卡片

点击内联高亮文字时弹出的操作卡片。

**卡片内容：**
- 问题严重级别图标 + 颜色（🔴 error / 🟡 warning / 🔵 info）
- 问题描述文字
- AI 建议修改内容（带 diff 高亮）
- 操作按钮：`✓ 接受建议` / `忽略` / `AI 重写`

**交互行为：**
- 点击高亮文字弹出，点击卡片外部或 ESC 关闭
- `接受建议`：直接替换编辑器中的文本，标注消失
- `忽略`：移除标注高亮，记录为已忽略
- `AI 重写`：向 Agent 发送指令，Agent 用虚拟光标定位到该处重写

**定位：** 卡片出现在高亮文字的正下方，如果空间不足则上方。使用 CodeMirror 的 `Tooltip` 扩展实现。

### 4.6 EditorReadOnlyGuard — 编辑器只读锁

Agent 操作期间的编辑器状态控制。

**行为：**
- Agent 开始操作时，设置 `EditorState.readOnly` 为 `true`
- 编辑器右上角显示状态指示：`🤖 Agent 正在输入...`
- 用户尝试输入时，显示轻量提示：「Agent 正在工作，可在右侧发送指令」
- Agent 操作完成或被停止后，解除只读

### 4.7 AgentProgressBar — 操作进度指示

位于 Agent 侧边栏的操作状态区域。

**显示内容：**
- 操作类型（生成中 / 审查中 / 重写中）
- 进度条（百分比，基于已写入字数 / 预估总字数）
- `⏹ 停止` 按钮

## 5. 用户旅程

### 5.1 首次进入（空白状态）

1. 用户打开脚本工作台，中间显示 `EmptyGuide` 引导页
2. 用户选择项目目录 或 导入文稿
3. Agent 侧边栏默认折叠，右侧有小图标指示
4. 导入文稿后，Agent 侧边栏自动展开，顶部显示快捷按钮 `✨ 生成口播稿`
5. Agent 对话区显示提示：「检测到原稿已导入（1,280字），你可以点击"生成口播稿"一键生成，或告诉我你想要什么风格。」

### 5.2 生成口播稿

1. 用户点击 `✨ 生成口播稿` 快捷按钮
2. Agent 接收预设指令，开始执行
3. **文件树**：`script.md` 以虚线边框 + 「创建中...」标记出现
4. **编辑器**：自动新开 `script.md` 标签页，右上角显示 `🤖 Agent 正在输入...`
5. **虚拟光标**出现在编辑器开头，开始流式写入内容
6. 文字以打字效果逐渐出现，编辑器自动滚动跟随
7. Agent 侧边栏显示进度：「正在生成口播稿... 已写入 326/~850 字」
8. 完成后：
   - 虚拟光标消失
   - 编辑器恢复可编辑状态
   - 文件树 `script.md` 变为正常状态，显示 `🆕` 标记
   - Agent 提示：「口播稿已生成 ✅ 856字 · 预计3分12秒」
   - 快捷按钮更新为 `🔍 AI 审查` + `重新生成`

### 5.3 AI 审查

1. 用户点击 `🔍 AI 审查` 快捷按钮
2. Agent 开始审查，编辑器进入只读模式
3. **虚拟光标**从文档顶部开始向下扫描
4. 遇到问题时：
   - 光标停在问题文字处
   - 文字逐渐被高亮标记（颜色渐入动画，约 300ms）
   - 轻微停顿后继续扫描
5. Agent 侧边栏实时更新：「扫描进度 45%，已发现 1 个问题」
6. 扫描完成后：
   - 虚拟光标消失
   - 编辑器恢复可编辑
   - Agent 提示：「审查完成，发现 2 个问题。点击高亮文字查看详情。」
   - 快捷按钮更新为 `✅ 全部接受` + `重新审查`

### 5.4 处理标注

1. 用户点击编辑器中的高亮文字
2. 弹出悬浮操作卡片，显示问题描述和 AI 建议
3. 用户选择：
   - **接受建议**：文字被替换，高亮消失，带轻微的替换动画
   - **忽略**：高亮消失，标注记录为已忽略
   - **AI 重写**：向 Agent 发送指令，虚拟光标移动到该位置，流式重写该段

### 5.5 自由对话

用户随时可以在 Agent 输入框中用自然语言提出任何要求：
- 「帮我把第二段改成更口语化的风格」
- 「这篇稿子的语气太正式了，整体改轻松一点」
- 「在结尾加一段总结」

Agent 理解意图后，虚拟光标定位到相应位置，流式执行编辑。

### 5.6 打断 Agent

Agent 工作期间，用户可以：
- 在输入框发送新指令 → Agent 停止当前操作，基于已写内容处理新指令
- 点击 `⏹ 停止` 按钮 → Agent 停止，已写入内容保留在编辑器中

## 6. 状态管理变更

### 6.1 移除

```typescript
// 从 ScriptState 中移除
currentStep: ScriptStep           // 不再需要步骤状态机
drawerVisible: boolean            // 不再需要抽屉
drawerContent: 'template' | 'annotations' | null
```

### 6.2 新增

```typescript
// 新增到 ScriptState 或独立 store
interface AgentOperationState {
  isOperating: boolean              // Agent 是否正在操作
  operationType: 'generate' | 'review' | 'rewrite' | 'custom' | null
  progress: number                  // 0-100 进度
  canInterrupt: boolean             // 是否可打断
}

// 编辑器状态
interface EditorAgentState {
  readOnly: boolean                 // Agent 操作时只读
  virtualCursorPos: number | null   // 虚拟光标位置，null 表示不显示
  streamingActive: boolean          // 是否正在流式写入
}
```

### 6.3 持久化变更

`script-state.json` 格式调整：

```typescript
interface PersistedScriptState {
  version: 2                        // 版本升级为 2
  templateId: string
  annotations: Annotation[]
  createdAt: string
  updatedAt: string
  // 移除 currentStep
  // 新增：
  lastOperation?: string            // 最后一次 Agent 操作的类型
  reviewCompleted?: boolean         // 是否已完成审查
}
```

需要向后兼容 version 1 格式。

## 7. 需要移除的组件

| 组件 | 路径 | 原因 |
|------|------|------|
| StepIndicator | `src/components/script/StepIndicator.tsx` | 步骤条不再需要 |
| StepReviewOriginal | `src/components/script/StepReviewOriginal.tsx` | 步骤逻辑移到 Agent |
| StepGenerate | `src/components/script/StepGenerate.tsx` | 生成逻辑移到 Agent |
| StepAIReview | `src/components/script/StepAIReview.tsx` | 审查逻辑移到 Agent |
| StepConfirm | `src/components/script/StepConfirm.tsx` | 确认逻辑简化为保存 |
| StepDrawer | `src/components/script/StepDrawer.tsx` | 模板选择移到 Agent 对话 |
| OperationBar 步骤逻辑 | `src/components/script/OperationBar.tsx` | 操作移到 Agent 快捷区 |

## 8. 需要新增的组件

| 组件 | 路径 | 职责 |
|------|------|------|
| AgentQuickActions | `src/components/agent/AgentQuickActions.tsx` | 侧边栏顶部快捷操作按钮 |
| AgentOperationInterceptor | `electron/acp/operation-interceptor.ts` | 拦截 Agent 文件写入，编排动画 |
| VirtualCursor | `src/components/script/VirtualCursor.ts` | CodeMirror 虚拟光标装饰 |
| StreamingEditor | `src/lib/streaming-editor.ts` | 流式写入时序控制器 |
| AnnotationCard | `src/components/script/AnnotationCard.tsx` | 悬浮标注操作卡片 |
| EditorReadOnlyGuard | `src/lib/editor-readonly-guard.ts` | Agent 操作时编辑器只读控制 |
| AgentProgressBar | `src/components/agent/AgentProgressBar.tsx` | Agent 操作进度指示 |

## 9. 需要修改的模块

| 模块 | 变更内容 |
|------|----------|
| `ScriptWorkbench.tsx` | 去掉步骤流程编排，接入 Agent 操作事件流 |
| `AgentSidebar.tsx` | 顶部插入 AgentQuickActions 区域 |
| `FileTreePanel.tsx` | 新增文件创建动画（虚线边框 + 创建中标记） |
| `script store` | 去掉 `currentStep` 状态机，新增 `AgentOperationState` |
| `script-persistence.ts` | 升级 `script-state.json` 为 v2，兼容 v1 |
| `electron/acp/fs-runtime.ts` | 在 `handleWriteFile` 中插入拦截层 |
| `electron/acp/ipc.ts` | 新增 `agent-streaming-edit` IPC 事件通道 |
| `ScriptEditor` | 集成 VirtualCursor 装饰、ReadOnlyGuard、流式插入 API |

## 10. 风险与注意事项

### 性能
- 流式写入大量文字时需要注意 CodeMirror dispatch 频率，建议批量更新（每次 10-20 字）而非逐字
- 虚拟光标的 CSS transition 在高频更新时可能卡顿，需要用 `requestAnimationFrame` 节流

### 兼容性
- `script-state.json` v1 → v2 需要迁移逻辑
- 旧项目目录如果有 v1 格式，打开时自动升级

### 边界情况
- Agent 操作中途网络断开：保留已写入内容，提示用户重试
- Agent 返回的内容与预期文件格式不符：拦截层校验后回退
- 用户快速连续点击快捷按钮：前一个操作自动取消

### 测试要点
- 拦截层 diff 计算的正确性
- 虚拟光标动画的流畅度
- 只读锁的启用/解除时机
- 打断操作后的状态一致性
- v1 → v2 持久化迁移
