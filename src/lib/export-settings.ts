export type ExportResolution = 'source' | '720p' | '540p' | '480p';
export type ExportQuality = 'speed' | 'balanced' | 'quality';

export interface ExportConfig {
  resolution: ExportResolution;
  quality: ExportQuality;
}

export interface ExportRenderConfig extends ExportConfig {
  renderWidth: number;
  renderHeight: number;
  x264Preset: 'ultrafast' | 'veryfast' | 'medium';
  videoBitrate: string;
  audioBitrate: string;
}

interface ExportOption<T extends string> {
  value: T;
  label: string;
  description: string;
}

const RESOLUTION_LONG_EDGE: Record<Exclude<ExportResolution, 'source'>, number> = {
  '720p': 1280,
  '540p': 960,
  '480p': 854,
};

const QUALITY_PROFILE: Record<
  ExportQuality,
  {
    x264Preset: ExportRenderConfig['x264Preset'];
    audioBitrate: string;
    videoBitrate: Record<ExportResolution, string>;
  }
> = {
  speed: {
    x264Preset: 'ultrafast',
    audioBitrate: '96k',
    videoBitrate: {
      source: '3500k',
      '720p': '1800k',
      '540p': '1200k',
      '480p': '900k',
    },
  },
  balanced: {
    x264Preset: 'veryfast',
    audioBitrate: '128k',
    videoBitrate: {
      source: '5500k',
      '720p': '3000k',
      '540p': '1900k',
      '480p': '1400k',
    },
  },
  quality: {
    x264Preset: 'medium',
    audioBitrate: '192k',
    videoBitrate: {
      source: '8000k',
      '720p': '4500k',
      '540p': '2800k',
      '480p': '2000k',
    },
  },
};

export const EXPORT_RESOLUTION_OPTIONS: ExportOption<ExportResolution>[] = [
  {
    value: 'source',
    label: '原始分辨率',
    description: '保持时间线原尺寸，画质最好，但导出会更慢。',
  },
  {
    value: '720p',
    label: '720p',
    description: '推荐。明显提速，仍适合大多数内容预览和分享。',
  },
  {
    value: '540p',
    label: '540p',
    description: '进一步降低分辨率，适合快速检查字幕与节奏。',
  },
  {
    value: '480p',
    label: '480p',
    description: '最快，适合首轮草稿检查。',
  },
];

export const EXPORT_QUALITY_OPTIONS: ExportOption<ExportQuality>[] = [
  {
    value: 'speed',
    label: '极速低码率',
    description: '编码最快，文件更小，适合草稿导出。',
  },
  {
    value: 'balanced',
    label: '平衡',
    description: '推荐。速度和画质更均衡。',
  },
  {
    value: 'quality',
    label: '标准质量',
    description: '更清晰，但导出更慢。',
  },
];

function ensureEvenDimension(value: number): number {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

function scaleToLongEdge(
  width: number,
  height: number,
  targetLongEdge: number,
): { width: number; height: number } {
  const sourceLongEdge = Math.max(width, height);
  if (sourceLongEdge <= targetLongEdge) {
    return {
      width: ensureEvenDimension(width),
      height: ensureEvenDimension(height),
    };
  }

  const scale = targetLongEdge / sourceLongEdge;

  return {
    width: ensureEvenDimension(width * scale),
    height: ensureEvenDimension(height * scale),
  };
}

export function getExportDimensions(
  timelineWidth: number,
  timelineHeight: number,
  resolution: ExportResolution,
): { width: number; height: number } {
  if (resolution === 'source') {
    return {
      width: ensureEvenDimension(timelineWidth),
      height: ensureEvenDimension(timelineHeight),
    };
  }

  return scaleToLongEdge(timelineWidth, timelineHeight, RESOLUTION_LONG_EDGE[resolution]);
}

export function buildExportRenderConfig({
  timelineWidth,
  timelineHeight,
  resolution,
  quality,
}: {
  timelineWidth: number;
  timelineHeight: number;
  resolution: ExportResolution;
  quality: ExportQuality;
}): ExportRenderConfig {
  const dimensions = getExportDimensions(timelineWidth, timelineHeight, resolution);
  const profile = QUALITY_PROFILE[quality];

  return {
    resolution,
    quality,
    renderWidth: dimensions.width,
    renderHeight: dimensions.height,
    x264Preset: profile.x264Preset,
    videoBitrate: profile.videoBitrate[resolution],
    audioBitrate: profile.audioBitrate,
  };
}
