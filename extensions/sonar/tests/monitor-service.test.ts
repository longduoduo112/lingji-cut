import { describe, it, expect, vi } from 'vitest';
import { createMonitorService } from '@/monitor/monitor-service';
import { createMemoryRepository } from '@/background/repository';
import type { Creator, Video } from '@/domain/models';

const creator: Creator = {
  id: 'c1',
  secUid: 'MS4w',
  nickname: '博主',
  profileUrl: 'https://www.douyin.com/user/MS4w',
  updatedAt: 0,
};
const v = (id: string): Video => ({
  id,
  creatorId: 'c1',
  description: id,
  publishedAt: Number(id),
  sourcePageUrl: `https://www.douyin.com/video/${id}`,
});

function setup(over: Record<string, unknown> = {}) {
  let seq = 0;
  const repo = createMemoryRepository({ now: () => 1000, newId: () => `id-${++seq}` });
  const notify = vi.fn(async () => {});
  const deps = {
    repo,
    notify,
    now: () => 1000,
    fetchCreatorVideos: vi.fn(async () => ({ videos: [v('3'), v('2'), v('1')] })),
    ...over,
  };
  return { repo, notify, deps };
}

describe('createMonitorService.runOnce', () => {
  it('notifies for videos newer than the known latest and updates the subscription', async () => {
    const { repo, notify, deps } = setup();
    await repo.followCreator({ creator, intervalMinutes: 30 });
    await repo.updateSubscription('c1', { latestVideoId: '1' });

    const svc = createMonitorService(deps as never);
    const result = await svc.runOnce('c1');

    expect(result.circuitBroken).toBe(false);
    expect(result.newVideoIds).toEqual(['3', '2']);
    expect(notify).toHaveBeenCalledTimes(2);
    const sub = await repo.getSubscription('c1');
    expect(sub?.latestVideoId).toBe('3');
    expect(sub?.lastCheckedAt).toBe(1000);
  });

  it('treats the first sync as a baseline without notifications', async () => {
    const { repo, notify, deps } = setup();
    await repo.followCreator({ creator, intervalMinutes: 30 });

    const result = await createMonitorService(deps as never).runOnce('c1');
    expect(result.newVideoIds).toEqual([]);
    expect(notify).not.toHaveBeenCalled();
    expect((await repo.getSubscription('c1'))?.latestVideoId).toBe('3');
  });

  it('trips the circuit breaker on login/captcha errors', async () => {
    const { repo, notify, deps } = setup({
      fetchCreatorVideos: vi.fn(async () => ({ errorCode: 'CAPTCHA_REQUIRED' })),
    });
    await repo.followCreator({ creator, intervalMinutes: 30 });

    const result = await createMonitorService(deps as never).runOnce('c1');
    expect(result.circuitBroken).toBe(true);
    expect(result.error?.code).toBe('CAPTCHA_REQUIRED');
    expect(notify).not.toHaveBeenCalled();
  });

  it('enqueues each newly detected video for processing via onNewVideo', async () => {
    const onNewVideo = vi.fn();
    const { repo, deps } = setup({ onNewVideo });
    await repo.followCreator({ creator, intervalMinutes: 30 });
    await repo.updateSubscription('c1', { latestVideoId: '1' });

    await createMonitorService(deps as never).runOnce('c1');

    expect(onNewVideo.mock.calls.map((c) => (c[0] as Video).id)).toEqual(['3', '2']);
  });

  it('does not call onNewVideo on the first-sync baseline', async () => {
    const onNewVideo = vi.fn();
    const { repo, deps } = setup({ onNewVideo });
    await repo.followCreator({ creator, intervalMinutes: 30 });

    await createMonitorService(deps as never).runOnce('c1');

    expect(onNewVideo).not.toHaveBeenCalled();
  });

  it('picks the least-recently-checked active subscription when no id is given', async () => {
    const { repo, deps } = setup();
    await repo.followCreator({ creator, intervalMinutes: 30 });
    await repo.followCreator({
      creator: { ...creator, id: 'c2', secUid: 'MS4w2' },
      intervalMinutes: 30,
    });
    await repo.updateSubscription('c1', { lastCheckedAt: 5000 });
    await repo.updateSubscription('c2', { lastCheckedAt: 100 });

    const result = await createMonitorService(deps as never).runOnce();
    expect(result.checkedCreatorIds).toEqual(['c2']);
  });
});
