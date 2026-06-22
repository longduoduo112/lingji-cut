/**
 * 把 Content Script 捕获到的抖音响应载入 Repository。
 *
 * 复用适配器把原始响应转成稳定模型；同时缓存原始 video 对象，供 resolveVideo 重新提取源。
 * 这里不做下载或 AI 判断，只负责入库。
 */
import { adaptAwemeDetail, adaptAwemePostList } from '@/adapter/video-adapter';
import { adaptCreator } from '@/adapter/creator-adapter';
import { pick } from '@/adapter/field';
import type { ResponseCategory } from '@/content/page-capture';
import type { Creator, Video } from '@/domain/models';
import type { Repository } from './repository';

export interface IngestResult {
  videoIds: string[];
  creatorId?: string;
}

function isCreatorShape(value: unknown): value is Creator {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return typeof c.id === 'string' && typeof c.secUid === 'string' && typeof c.nickname === 'string';
}

function isVideoShape(value: unknown): value is Video {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.creatorId === 'string';
}

/**
 * 载入「主动提取」的博主主页结果（DOM/SSR fallback，详见 content/dom-extractor.ts）。
 * 入参已是规整后的稳定模型；这里只做最小结构校验并入库（与 ingestCapture 行为对齐：
 * upsert 博主与作品，幂等）。DOM 提取拿不到 raw video 对象，故不写 cacheRawVideo——
 * 源提取仍走作品详情页的既有捕获路径。
 */
export async function ingestDomCreatorPage(
  repo: Repository,
  creator: unknown,
  videos: unknown,
): Promise<IngestResult> {
  if (!isCreatorShape(creator)) return { videoIds: [] };
  const list = Array.isArray(videos) ? videos.filter(isVideoShape) : [];
  // API 捕获可能先以内部 uid 建过 Creator/Subscription；DOM fallback 只有 secUid。
  // 同一个 secUid 必须复用已有 id，否则作品会挂到第二个 Creator 上，工作台按订阅 id 过滤后显示 0 条。
  const subscribed = (await repo.listSubscriptions()).find((sub) => sub.creator.secUid === creator.secUid)?.creator;
  const existing = subscribed ?? (await repo.getCreatorBySecUid(creator.secUid));
  const creatorId = existing?.id ?? creator.id;
  const canonicalCreator: Creator = { ...existing, ...creator, id: creatorId };
  const canonicalVideos = list.map((video) => ({ ...video, creatorId }));
  await repo.upsertCreator(canonicalCreator);
  if (canonicalVideos.length > 0) await repo.upsertVideos(canonicalVideos);
  return { videoIds: canonicalVideos.map((v) => v.id), creatorId };
}

export async function ingestCapture(
  repo: Repository,
  category: ResponseCategory,
  payload: unknown,
  now: () => number,
): Promise<IngestResult> {
  if (category === 'video_detail') {
    const adapted = adaptAwemeDetail(payload, now());
    if (!adapted) return { videoIds: [] };
    await repo.upsertCreator(adapted.creator);
    await repo.upsertVideos([adapted.video]);
    const rawVideo = pick(pick(payload, ['aweme_detail', 'awemeDetail']), ['video']);
    if (rawVideo) await repo.cacheRawVideo(adapted.video.id, rawVideo);
    return { videoIds: [adapted.video.id], creatorId: adapted.creator.id };
  }

  if (category === 'creator_videos') {
    const { videos, creator } = adaptAwemePostList(payload, now());
    if (creator) await repo.upsertCreator(creator);
    await repo.upsertVideos(videos);
    const list = pick(payload, ['aweme_list', 'awemeList']);
    if (Array.isArray(list)) {
      for (const item of list) {
        const id = pick(item, ['aweme_id', 'awemeId']);
        const rawVideo = pick(item, ['video']);
        if (typeof id === 'string' && rawVideo) await repo.cacheRawVideo(id, rawVideo);
      }
    }
    return {
      videoIds: videos.map((v) => v.id),
      ...(creator ? { creatorId: creator.id } : {}),
    };
  }

  if (category === 'creator_profile') {
    const creator = adaptCreator(pick(payload, ['user']), now());
    if (!creator) return { videoIds: [] };
    await repo.upsertCreator(creator);
    return { videoIds: [], creatorId: creator.id };
  }

  return { videoIds: [] };
}
