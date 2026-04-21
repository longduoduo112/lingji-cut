# 灵机剪影

`灵机剪影` 是一个本地优先的桌面端播客 / 口播视频创作工作台。它把“选题素材 → 口播稿 → TTS 音频与字幕 → 时间线编辑 → AI 视觉卡片 / 封面 / 动画 → MP4 导出”串成一个可持续迭代的工程。

项目当前不是单纯的视频播放器或字幕工具，而是面向内容创作者的 Electron 桌面应用：脚本工作台、AI Agent、MCP 工具、Remotion 渲染、素材时间线都在同一个项目目录里协同。

## 核心能力

- 项目管理：欢迎页支持新建工程、打开工程、最近工程、关闭工程与工程元数据读取。
- 脚本工作台：支持 `original.md` / `script.md`、多文件标签、文件树、搜索 / 替换、版本历史、AI 生成、AI 审稿、批注采纳、外部文件冲突处理。
- 视频导入：支持抖音链接导入，自动下载、抽音频、转录、生成 `transcript.md` / `transcript.srt`，并可同步为 `original.md`。
- 口播生成：支持 MiniMax TTS，生成 `podcast-audio.mp3`、`podcast-subtitles.srt` 和原始字幕备份。
- 字幕处理：支持 SRT 解析、自动重切分、关键词高亮、字幕样式调整与高亮过期校验。
- 时间线编辑：支持音频、字幕、图片、视频、文字、AI 卡片、多视觉轨、多音频叠加轨、拖拽、吸附、拆分、裁剪、复制 / 剪切 / 粘贴、轨道锁定。
- AI 内容分析：基于字幕做分段规划、摘要、关键词、信息卡、封面提示词和视觉编排建议。
- AI 视觉内容：支持网页信息卡、Motion Card、导入 HTML 卡片、AI 生成 / 修改 / 自动修复 Remotion 动画卡。
- 图片生成：内置即梦、OpenAI Image、MiniMax、豆包、Imagen、通义万相以及自定义 OpenAI 兼容图像 Provider。
- Agent / MCP：应用内可连接 Claude ACP Runtime，并暴露 `lingji_*` MCP 工具给 Claude Code / Codex / Gemini 等客户端操作脚本编辑器。
- 导出：通过 Remotion 渲染 `PodcastComposition`，支持 H.264 MP4、导出分辨率与质量配置、进度展示。
- 配置管理：支持 AI Provider、图片 Provider、TTS、提示词、Agent、MCP、配置备份 / 恢复。

## 技术栈

- Electron 41 + electron-vite
- React 19 + TypeScript 6
- Remotion 4
- Zustand
- CodeMirror 6
- Framer Motion
- TailwindCSS 4 + 自研 macOS 专业工具 UI 组件
- MCP SDK + Claude ACP 集成
- Vitest

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发环境

```bash
npm run dev
```

### 3. 构建

```bash
npm run build
```

### 4. 打包 macOS 应用

```bash
npm run package:mac
```

或者一步完成构建与打包：

```bash
npm run dist:mac
```

默认产物在 `release/` 下：

- `release/灵机剪影-darwin-arm64/灵机剪影.app`
- `release/灵机剪影-darwin-x64/灵机剪影.app`

当前打包产物是本地 `.app`，尚未接入正式签名、notarization、DMG / PKG 分发。

### 5. 测试

```bash
npm test
```

运行单个测试文件：

```bash
npx vitest run tests/editor.test.tsx
```

## 常用命令

```bash
npm run dev          # 启动 Electron + Vite 开发环境
npm run build        # 构建主进程、preload 与 renderer，并执行混淆脚本
npm run package:mac  # 打包 macOS .app
npm run dist:mac     # 构建 + 打包 macOS .app
npm test             # 运行 Vitest
npm run test:watch   # Vitest watch 模式
```

## 典型使用流程

### 从脚本生成视频草稿

1. 在欢迎页新建脚本项目。
2. 导入原始素材，或通过抖音链接导入并自动转录为 `original.md`。
3. 在脚本工作台选择口播模板和角色，生成或手写 `script.md`。
4. 使用 AI 审稿批注修订文稿。
5. 触发 AI 视频流水线：MiniMax TTS → 字幕解析 → 内容分析 → 封面生成 → 信息卡排布。
6. 进入编辑器，调整时间线、素材、字幕、卡片、动画。
7. 导出 MP4。

### 从已有音频和字幕编辑

1. 新建或打开项目目录。
2. 在 Setup 页导入音频与 SRT。
3. 进入 Editor 页后编辑时间线。
4. 可选：运行 AI 字幕分析、生成卡片和封面。
5. 导出 MP4。

## AI 配置

应用主要通过“设置”页面保存 AI 配置，不依赖仓库内 `.env` 存放密钥。

主要配置区域：

- `AI 基础配置`：管理多 LLM Provider，重点支持 OpenAI 兼容、Gemini、LM Studio 等运行时配置，并保留 Anthropic 类型的模型列表配置能力。
- `图片生成`：管理即梦、OpenAI Image、MiniMax、豆包、Imagen、通义万相、自定义图像 Provider。
- `TTS 语音合成`：配置 MiniMax API Key、音色、语速、音量、音调、情绪和模型。
- `提示词配置`：管理内置 / 全局 / 项目级提示词，支持为不同 Prompt Kind 绑定不同 LLM / Image Provider。
- `AI Agent`：配置 Claude ACP、权限策略、运行时安装与 API Key。
- `MCP 服务`：启动本地 MCP Server，并注册到 Claude Code / Codex / Gemini。
- `配置备份`：导出 / 预览 / 导入全局设置与 Agent 配置备份。

不要把真实 API Key、Session ID 或访问令牌硬编码进源码、测试或文档示例。

## 工程目录结构

应用运行时会把数据保存在用户选择的项目目录中，仓库根目录不是唯一数据源。

当前主工程文件：

- `project.json`：统一工程文件，包含 `timeline`、`aiAnalysis`、`script` 三个主要段。
- `original.md`：原始素材 / 转录文本。
- `script.md`：口播成稿。
- `podcast-audio.mp3`：MiniMax TTS 生成的口播音频。
- `podcast-subtitles.srt`：口播字幕。
- `podcast-subtitles.original.srt`：TTS 初始字幕备份。
- `covers/`：封面候选图。
- `ai-cards/`：AI 网页卡片落盘后的 HTML。
- `imports/douyin/<videoId>/`：抖音导入的视频、音频、转录、元数据与预览文档。
- `configs/prompts/`：项目级提示词覆盖。

历史版本中的 `timeline.json`、`ai-analysis.json`、`script-state.json` 会在加载旧工程时迁移到 `project.json`。部分旧 IPC 仍保留兼容，但新开发应优先使用 `loadProject` / `saveProjectSection`。

仓库内的 `work/`、`images/`、`dist/`、`dist-electron/`、`release/` 多数是示例、调试或构建产物，不应作为真实用户工程数据源。

## 代码结构

```text
electron/
  acp/                  Claude ACP Runtime、权限策略、Agent 配置
  conversations/         Agent 会话数据库与 IPC
  mcp/                   灵机 MCP Server、工具注册、客户端注册配置
  script-history/        脚本文稿版本历史
  video-import/          抖音导入、抽音频、ASR、转录落盘
  main.ts                Electron 主进程、IPC、Remotion 渲染
  preload.ts             Renderer 安全桥接
  project-file.ts        project.json 读写与旧工程迁移

src/
  components/            编辑器、时间线、Inspector、AI 面板、Agent UI
  components/script/     脚本工作台文件树、批注、导入预览、版本 UI
  components/settings/   AI、TTS、Agent、MCP、提示词、备份配置页
  hooks/                 AI 视频流水线、连接状态、缩略图等 hooks
  lib/                   AI、提示词、Motion、字幕、导出、持久化、IPC 客户端
  pages/                 Setup、Editor、ScriptWorkbench、Settings
  remotion/              Remotion Composition 与 overlay 渲染
  store/                 timeline、ai、script、agent、task-progress
  ui/                    macOS 风格基础组件、patterns、tokens、motion
  types.ts               时间线核心类型
  types/ai.ts            AI 卡片、Provider、提示词绑定类型

tests/                   Vitest 单元与组件测试
docs/superpowers/        设计规格与实施计划沉淀
```

## 关键架构约束

- Renderer 不直接使用 Node API。主进程能力必须通过 `electron/preload.ts` 暴露，并在 `src/lib/electron-api.ts` 声明类型。
- 新增或修改 IPC 时，通常要同步 `electron/main.ts`、`electron/preload.ts`、`src/lib/electron-api.ts` 和对应测试。
- 工程主存储是 `project.json`。新增工程段落前先评估迁移、并发写锁和旧数据兼容。
- Remotion 导出入口固定为 `src/remotion/index.ts`，Composition ID 固定为 `PodcastComposition`。
- 导出前会把绝对路径素材映射到临时 public 目录，避免 Remotion 打包时无法访问本地文件。
- AI 网页卡片的 `srcDoc` 会落盘到 `ai-cards/`，持久化后优先保存 `src` 路径。
- 所有耗时操作应接入 `src/store/task-progress.ts` 和底部 `AppStatusBar` 统一进度系统。
- UI 新实现必须遵循 `DESIGN.md` 的 macOS 专业创作工具规范，不要回退到旧的 Apple 官网风格。
- Agent / MCP 操作脚本文稿时，应优先通过 `lingji_*` MCP 工具进入编辑器状态，不要绕过应用直接改 `script.md`。

## 开发建议

- 修改时间线结构前，先看 `src/types.ts`、`src/store/timeline.ts`、`src/lib/timeline-tracks.ts`、`src/lib/timeline-placement.ts`。
- 修改 AI 卡片结构前，先看 `src/types/ai.ts`、`src/lib/ai-persistence.ts`、`src/store/ai.ts`、`src/remotion/cards/`。
- 修改脚本工作台前，先看 `src/pages/ScriptWorkbench.tsx`、`src/store/script.ts`、`src/lib/script-persistence.ts`。
- 修改提示词前，先看 `src/lib/prompts/`、`electron/prompts-io.ts`、`electron/prompt-bindings-io.ts`。
- 修改 Agent / MCP 前，先看 `electron/acp/`、`electron/mcp/`、`src/components/agent/`。
- 修改导出链路前，先看 `electron/main.ts`、`src/lib/remotion-assets.ts`、`src/remotion/Root.tsx`。

## 已知边界

- 桌面优先，最小窗口约束为 1100×760，不以移动端为主要目标。
- Setup 的传统导入仍以音频 + SRT 为主；脚本到视频流程依赖 MiniMax TTS。
- 抖音导入当前使用 `bcut` 转录链路，外部服务可用性会影响结果。
- AI 分析、图片生成、TTS、Agent Runtime 都依赖用户配置的外部服务。
- macOS 打包尚未覆盖正式签名和分发链路。

## License

当前仓库 `package.json` 标记为 `ISC`。
