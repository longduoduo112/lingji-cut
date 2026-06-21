/**
 * 子系统服务契约（下载 / 媒体处理 / 监控 / 导出 / Provider 连通性测试）。
 *
 * handler 只依赖这里的接口，下载、Offscreen 音频提取、ASR、摘要与监控均可独立测试
 * 和替换实现。
 *
 * 默认 stub 返回**标准化错误**而非假成功：在子系统接入前，API 仍然连通（请求能路由、
 * 能拿到结构化结果），但如实反映「能力尚未就绪 / 未配置」。
 */
import type { Creator, DownloadTask, ProcessingTask, Video, VideoSource } from '@/domain/models';
import type {
  ExportTask,
  MarkdownExportInput,
  MonitorResult,
  ProcessVideoOptions,
  ProviderTestResult,
  TestAiProviderInput,
} from '@/domain/api-types';
import { SonarException, makeError } from '@/domain/errors';

export interface DownloadRequest {
  video: Video;
  creator: Creator | null;
  source: VideoSource;
}

export interface DownloadService {
  download(req: DownloadRequest): Promise<DownloadTask>;
  cancel(taskId: string): Promise<void>;
}

export interface ProcessingService {
  /** 同步运行整条管线，到终态才 resolve（自动监控串行队列用）。 */
  process(videoId: string, options?: ProcessVideoOptions): Promise<ProcessingTask>;
  /** 即时返回 queued 任务，管线在后台推进；供 UI 轮询阶段，不阻塞调用方。 */
  start(videoId: string, options?: ProcessVideoOptions): Promise<ProcessingTask>;
  cancel(taskId: string): Promise<void>;
}

export interface MonitorService {
  runOnce(creatorId?: string): Promise<MonitorResult>;
}

export interface ExportService {
  exportMarkdown(input: MarkdownExportInput): Promise<ExportTask>;
}

export interface AiProviderTester {
  test(input: TestAiProviderInput): Promise<ProviderTestResult>;
}

export interface Services {
  download: DownloadService;
  processing: ProcessingService;
  monitor: MonitorService;
  export: ExportService;
  aiTester: AiProviderTester;
}

/**
 * 默认 stub：子系统尚未接入时如实失败。
 * 监控返回空的、未熔断的结果（无收藏即无新作品，是合法的真实结果）。
 */
export function createStubServices(): Services {
  return {
    download: {
      async download() {
        throw new SonarException(
          makeError('DOWNLOAD_FAILED', '下载能力尚未接入', { nextAction: '等待下载模块上线' }),
        );
      },
      async cancel() {
        /* no-op */
      },
    },
    processing: {
      async process() {
        throw new SonarException(
          makeError('ASR_NOT_CONFIGURED', '媒体处理能力尚未接入', {
            nextAction: '等待转录/摘要模块上线',
          }),
        );
      },
      async start() {
        throw new SonarException(
          makeError('ASR_NOT_CONFIGURED', '媒体处理能力尚未接入', {
            nextAction: '等待转录/摘要模块上线',
          }),
        );
      },
      async cancel() {
        /* no-op */
      },
    },
    monitor: {
      async runOnce() {
        return { checkedCreatorIds: [], newVideoIds: [], circuitBroken: false };
      },
    },
    export: {
      async exportMarkdown() {
        throw new SonarException(makeError('EXPORT_FAILED', '导出能力尚未接入'));
      },
    },
    aiTester: {
      async test() {
        return { ok: false, error: makeError('SUMMARY_NOT_CONFIGURED', '尚未配置该 Provider') };
      },
    },
  };
}
