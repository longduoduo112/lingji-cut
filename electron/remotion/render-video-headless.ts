// 由 electron/main.ts 的 render-video IPC 处理体抽取；无行为变更。
// 唯一改动：三处 `mainWindow?.webContents.send('render-progress', X)` 替换为 `onProgress(X)`。
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { app } from 'electron';
import type { ExportConfig } from '../../src/lib/export-settings';
import { buildExportRenderConfig } from '../../src/lib/export-settings';
import type { SrtEntry, TimelineData } from '../../src/types';
import { parseSrt } from '../../src/lib/srt-parser';
import { compileCards, type CompiledCard } from './compile-card-node';
import { getRemotionBundle } from './bundle';
import { renderRemotionVideo } from './render';
import { collectMotionCards } from '../../src/remotion/collect-cards';
import { hydrateTimelineCards } from '../../src/lib/motion-card-externalize';
import { prepareTimelineForHyperframes, type HyperframesAssetDescriptor } from '../../src/hyperframes/assets';
import {
  collectMotionCardAssets,
  externalizeMotionCardDataUris,
  rewriteMotionCardAssetReferences,
} from './motion-card-assets';

// 以下三个辅助函数由 electron/main.ts 原样迁入（仅 render-video 使用）。

async function materializeRenderAssets(
  publicDir: string,
  assets: HyperframesAssetDescriptor[],
): Promise<void> {
  await Promise.all(
    assets.map(async (asset) => {
      const targetPath = path.join(publicDir, asset.publicPath);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });

      try {
        await fs.link(asset.sourcePath, targetPath);
      } catch {
        await fs.copyFile(asset.sourcePath, targetPath);
      }
    }),
  );
}

/**
 * 从 timeline 反推项目目录：podcast-audio.mp3 / podcast-subtitles.srt 都
 * 位于 projectDir 根，用 audioPath 的 dirname 即得（项目硬约定）。
 * 用于把 ai-card MediaCardContent 的相对路径解析为绝对，再做 public 映射。
 */
function inferProjectDirFromTimeline(timeline: TimelineData): string | null {
  const audio = timeline.podcast?.audioPath;
  if (audio && path.isAbsolute(audio)) return path.dirname(audio);
  const srt = timeline.podcast?.srtPath;
  if (srt && path.isAbsolute(srt)) return path.dirname(srt);
  return null;
}

export async function createRenderPublicDir(
  timeline: TimelineData,
): Promise<{ timeline: TimelineData; publicDir: string }> {
  const projectDir = inferProjectDirFromTimeline(timeline);
  const { timeline: renderTimeline, assets } = prepareTimelineForHyperframes(
    timeline,
    projectDir,
  );
  const motionCardAssets = await collectMotionCardAssets(timeline, projectDir);
  const publicDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lingjijianying-public-'));
  await materializeRenderAssets(publicDir, [...assets, ...motionCardAssets]);

  return {
    timeline: renderTimeline,
    publicDir,
  };
}

export interface RenderVideoArgs {
  timeline: string;
  outputPath: string;
  exportConfig: ExportConfig;
  // Renderer 侧 store 中切分后的字幕；若未提供则回退到磁盘原始 SRT。
  // 磁盘 .srt 文件始终保持 MiniMax 原始输出（不写回），所以若只靠主进程重解析
  // 就会忽略用户的字幕重切分结果，与预览播放器不一致。
  srtEntries?: SrtEntry[];
}

export async function renderVideoHeadless(
  args: RenderVideoArgs,
  opts: {
    onProgress?: (fraction: number) => void;
    onMotionCardCompileErrors?: (errors: CompiledCard[], total: number) => void;
    /**
     * 可选 telemetry 钩子，签名与 main.ts 的 makeMainTelemetry 产物兼容。
     * 缺省 no-op。发出 4 个 stage：export.assets / export.compile-cards / export.bundle / export.render。
     */
    telemetry?: { emit: (kind: string, extra?: Record<string, unknown>) => void };
  } = {},
): Promise<{ outputPath: string }> {
  const onProgress = opts.onProgress ?? (() => {});
  const tel = opts.telemetry ?? { emit: () => undefined };

  const isDev = !app.isPackaged;
  const renderLogPrefix = '[render-video]';
  const renderStartedAt = Date.now();
  const timestamp = () => `${((Date.now() - renderStartedAt) / 1000).toFixed(2)}s`;

  const timelineData = JSON.parse(args.timeline) as TimelineData;
  const srtEntries =
    args.srtEntries && args.srtEntries.length > 0
      ? args.srtEntries
      : timelineData.podcast.srtPath
        ? parseSrt(await fs.readFile(timelineData.podcast.srtPath, 'utf-8'))
        : [];

  const cpuCount = os.cpus().length;
  // 帧渲染是 Chromium 截图主导的 CPU 任务；cpu-2 给系统留一点喘息，避免输入卡顿。
  const explicitConcurrency = Math.max(1, cpuCount - 2);

  // 把 UI 档位（resolution + quality）展开成完整的渲染配置：
  // - x264Preset / videoBitrate / audioBitrate 直接落到 renderMedia；
  // - 三档统一走 videoBitrate + hardwareAcceleration:'if-possible'，能 GPU 编码就 GPU，
  //   不能则自动回退软编（Remotion crf.js:50 校验：videoBitrate 与 crf 互斥）。
  const renderConfig = buildExportRenderConfig({
    timelineWidth: timelineData.width,
    timelineHeight: timelineData.height,
    resolution: args.exportConfig.resolution,
    quality: args.exportConfig.quality,
  });
  // 用 scale 而不是覆盖 composition 尺寸：React 树仍按 timeline.width/height 渲染，
  // 所有 px 字号/padding/位置完全等同预览；renderMedia 拍照时按 scale 像素化输出。
  // 这样字幕字号在 720p / 540p / 480p 上视觉占比与预览一致，不会变大变小。
  const exportScale = Math.max(0.05, Math.min(1, renderConfig.renderWidth / timelineData.width));

  if (isDev) {
    console.log(`${renderLogPrefix} 开始导出`, {
      outputPath: args.outputPath,
      resolution: args.exportConfig.resolution,
      quality: args.exportConfig.quality,
      timelineSize: `${timelineData.width}x${timelineData.height}`,
      exportSize: `${renderConfig.renderWidth}x${renderConfig.renderHeight}`,
      scale: exportScale,
      x264Preset: renderConfig.x264Preset,
      videoBitrate: renderConfig.videoBitrate,
      audioBitrate: renderConfig.audioBitrate,
      hardwareAcceleration: 'if-possible',
      cpuCount,
      explicitConcurrency,
      platform: process.platform,
      arch: process.arch,
    });
  }

  // ── stage: export.assets ──────────────────────────────────────────
  const assetsStart = Date.now();
  tel.emit('stage.start', {
    stage: 'export.assets',
    resolution: args.exportConfig.resolution,
    quality: args.exportConfig.quality,
    renderWidth: renderConfig.renderWidth,
    renderHeight: renderConfig.renderHeight,
    scale: exportScale,
  });
  const projectPrepStart = assetsStart;
  // materialize 资源到临时 publicDir，并把 timeline 内绝对素材路径改写为 assets/... 相对路径。
  const { timeline: renderTimeline, publicDir } = await createRenderPublicDir(timelineData);
  // 防御性 hydrate：若上游传来的是磁盘态（只有 tsxPath 没有内存 tsx），读回源码，保证 collectMotionCards 能拿到卡片。
  const projectDir = inferProjectDirFromTimeline(timelineData);
  const hydratedTimeline = await hydrateTimelineCards(renderTimeline, {
    readFile: async (rel) => {
      if (!projectDir) return null;
      try {
        return await fs.readFile(path.join(projectDir, rel), 'utf-8');
      } catch {
        return null;
      }
    },
  });
  // 把卡片内联的大体积 base64 图片外置成 publicDir 下的真实文件，避免 60MB+ 的
  // inputProps 经 structuredClone 撑爆无头 Chrome（DataCloneError / 进程被 kill）。
  // 收集阶段同步攒 bytes，循环后统一落盘。卡片里替换为 cardAsset('card-assets/...')，
  // 由 CardHost 在导出环境解析为 staticFile。
  const externalizedCardAssets = new Map<string, Buffer>();
  for (const overlay of hydratedTimeline.overlays) {
    const motionCard = overlay.aiCardData?.motionCard;
    if (motionCard?.tsx) {
      const externalized = externalizeMotionCardDataUris(motionCard.tsx, {
        write: (bytes, ext) => {
          const hash = crypto.createHash('sha1').update(bytes).digest('hex').slice(0, 16);
          const rel = `card-assets/${hash}.${ext}`;
          if (!externalizedCardAssets.has(rel)) externalizedCardAssets.set(rel, bytes);
          return rel;
        },
      });
      motionCard.tsx = rewriteMotionCardAssetReferences(externalized);
    }
  }
  await Promise.all(
    [...externalizedCardAssets.entries()].map(async ([rel, bytes]) => {
      const target = path.join(publicDir, rel);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, bytes);
    }),
  );
  if (isDev && externalizedCardAssets.size > 0) {
    console.log(
      `${renderLogPrefix} 外置卡片内联图片 ${externalizedCardAssets.size} 个 → ${publicDir}/card-assets`,
    );
  }
  tel.emit('stage.end', {
    stage: 'export.assets',
    durationMs: Date.now() - assetsStart,
    ok: true,
    externalizedCardAssets: externalizedCardAssets.size,
  });

  try {
    // ── stage: export.compile-cards ─────────────────────────────────
    const compileStart = Date.now();
    // 编译 motion 卡片 TSX → CJS，随 inputProps 传入 Remotion，由 CardHost 在无头 Chrome 内求值。
    const cardSources = collectMotionCards(hydratedTimeline);
    tel.emit('stage.start', { stage: 'export.compile-cards', total: cardSources.length });
    const compiledCards = await compileCards(cardSources, {
      onCompileErrors: opts.onMotionCardCompileErrors,
    });
    tel.emit('stage.end', {
      stage: 'export.compile-cards',
      durationMs: Date.now() - compileStart,
      ok: true,
      total: cardSources.length,
      compiled: Object.keys(compiledCards).length,
    });
    const remotionEntry = path.join(app.getAppPath(), 'src', 'remotion', 'index.ts');

    if (isDev) {
      console.log(
        `${renderLogPrefix} 资源准备完成 耗时=${(
          (Date.now() - projectPrepStart) / 1000
        ).toFixed(2)}s cards=${cardSources.length} @${timestamp()}`,
      );
    }

    // ── stage: export.bundle ────────────────────────────────────────
    const bundleStart = Date.now();
    tel.emit('stage.start', { stage: 'export.bundle' });
    let serveUrl: string;
    try {
      serveUrl = await getRemotionBundle(remotionEntry, publicDir);
      tel.emit('stage.end', {
        stage: 'export.bundle',
        durationMs: Date.now() - bundleStart,
        ok: true,
      });
    } catch (err) {
      tel.emit('stage.end', {
        stage: 'export.bundle',
        durationMs: Date.now() - bundleStart,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    // ── stage: export.render ────────────────────────────────────────
    const renderStart = Date.now();
    tel.emit('stage.start', {
      stage: 'export.render',
      concurrency: explicitConcurrency,
      hardwareAcceleration: 'if-possible',
    });
    onProgress(0.05);
    try {
      await renderRemotionVideo({
        serveUrl,
        outputPath: args.outputPath,
        timeline: renderTimeline,
        srtEntries,
        compiledCards,
        width: renderConfig.renderWidth,
        height: renderConfig.renderHeight,
        x264Preset: renderConfig.x264Preset,
        videoBitrate: renderConfig.videoBitrate,
        audioBitrate: renderConfig.audioBitrate,
        concurrency: explicitConcurrency,
        hardwareAcceleration: 'if-possible',
        onProgress: (ratio) => onProgress(Math.max(0.05, Math.min(0.98, ratio))),
      });
      onProgress(1);
      tel.emit('stage.end', {
        stage: 'export.render',
        durationMs: Date.now() - renderStart,
        ok: true,
      });
    } catch (err) {
      tel.emit('stage.end', {
        stage: 'export.render',
        durationMs: Date.now() - renderStart,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    if (isDev) {
      console.log(
        `${renderLogPrefix} remotion render 完成 总耗时=${((Date.now() - renderStart) / 1000).toFixed(2)}s`,
      );
    }

    return { outputPath: args.outputPath };
  } catch (err) {
    if (isDev) {
      console.error(`${renderLogPrefix} 导出失败 @${timestamp()}`, err);
    }
    throw err;
  } finally {
    await fs.rm(publicDir, { recursive: true, force: true });
  }
}
