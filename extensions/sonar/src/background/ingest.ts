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
import type { Repository } from './repository';

export interface IngestResult {
  videoIds: string[];
  creatorId?: string;
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
