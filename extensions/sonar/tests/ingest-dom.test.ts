import { describe, expect, it } from 'vitest';
import { ingestDomCreatorPage } from '@/background/ingest';
import { createMemoryRepository } from '@/background/repository';

describe('ingestDomCreatorPage', () => {
  it('reuses the existing creator id for the same secUid', async () => {
    const repo = createMemoryRepository({ now: () => 1, newId: () => 'x' });
    // 模拟旧版 DOM fallback 已错误创建过一个以 secUid 为 id 的重复 Creator。
    await repo.upsertCreator({
      id: 'sec-uid',
      secUid: 'sec-uid',
      nickname: '重复记录',
      profileUrl: 'https://www.douyin.com/user/sec-uid',
      updatedAt: 1,
    });
    await repo.upsertCreator({
      id: 'internal-creator-id',
      secUid: 'sec-uid',
      nickname: '旧名称',
      profileUrl: 'https://www.douyin.com/user/sec-uid',
      updatedAt: 1,
    });
    await repo.followCreator({
      creator: (await repo.getCreator('internal-creator-id'))!,
      intervalMinutes: 30,
    });

    await ingestDomCreatorPage(
      repo,
      {
        id: 'sec-uid',
        secUid: 'sec-uid',
        nickname: '新名称',
        profileUrl: 'https://www.douyin.com/user/sec-uid',
        updatedAt: 2,
      },
      [{ id: 'video-1', creatorId: 'sec-uid', description: '作品', publishedAt: 2, sourcePageUrl: 'u' }],
    );

    expect((await repo.getVideo('video-1'))?.creatorId).toBe('internal-creator-id');
    expect((await repo.getCreator('internal-creator-id'))?.nickname).toBe('新名称');
    expect((await repo.getCreator('sec-uid'))?.nickname).toBe('重复记录');
  });
});
