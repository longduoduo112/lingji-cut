/**
 * 转录完成 → 推桥的编排（设计文档第 7 节）。
 *
 * 处理队列成功转录某作品后调用：读 settings/video/creator/transcript，组装负载并入队到桥。
 * 桥未启用、作品/转录缺失则静默跳过。纯逻辑（repo/client/settings 注入），可单测。
 */
import type { Creator, TranscriptDocument, Video } from '@/domain/models';
import type { BridgeClient, BridgeConfig, EnqueueOutcome } from './bridge-client';
import type { BridgeSettingsStore } from './bridge-settings';
import { buildBridgePayload } from './payload-builder';

export interface PushOnProcessedDeps {
  repo: {
    getVideo(id: string): Promise<Video | null>;
    getCreator(id: string): Promise<Creator | null>;
    getTranscript(videoId: string): Promise<TranscriptDocument | null>;
  };
  bridgeSettings: BridgeSettingsStore;
  bridgeClient: Pick<BridgeClient, 'enqueue'>;
}

export type PushResult =
  | { pushed: false; reason: 'disabled' | 'no-video' | 'no-payload' }
  | { pushed: true; outcome: EnqueueOutcome };

export function createPushOnProcessed(deps: PushOnProcessedDeps) {
  return async function pushOnProcessed(videoId: string): Promise<PushResult> {
    const settings: BridgeConfig = await deps.bridgeSettings.get();
    if (!settings.enabled) return { pushed: false, reason: 'disabled' };

    const video = await deps.repo.getVideo(videoId);
    if (!video) return { pushed: false, reason: 'no-video' };

    const [creator, transcript] = await Promise.all([
      deps.repo.getCreator(video.creatorId),
      deps.repo.getTranscript(videoId),
    ]);
    const payload = buildBridgePayload(video, creator, transcript);
    if (!payload) return { pushed: false, reason: 'no-payload' };

    const outcome = await deps.bridgeClient.enqueue(settings, payload);
    return { pushed: true, outcome };
  };
}
