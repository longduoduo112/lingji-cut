/** 工作台共享数据层：聚合视频、博主订阅、AI 分析与本地 UI 状态，产出视图模型。 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DouyinClient } from '@/client';
import type { Creator, CreatorSubscription, Video, VideoAnalysis } from '@/domain/models';
import { SonarException } from '@/domain/errors';
import { formatRelative, initialOf } from '@/ui/format';

export function errText(e: unknown): string {
  return e instanceof SonarException ? e.error.message : String(e);
}

export interface CreatorView {
  id: string;
  nickname: string;
  handle: string;
  group: string;
  initial: string;
  avatarUrl?: string;
  monitoring: boolean;
  intervalMinutes: number;
  lastSync: string;
  videoCount?: number;
  sub: CreatorSubscription;
}

function handleOf(creator: Creator): string {
  try {
    const seg = new URL(creator.profileUrl).pathname.split('/').filter(Boolean).pop();
    if (seg) return `@${seg}`;
  } catch {
    /* 非法 URL，退回 secUid 片段 */
  }
  return `@${creator.secUid.slice(0, 12)}`;
}

export function toCreatorView(sub: CreatorSubscription, now: number): CreatorView {
  const c = sub.creator;
  return {
    id: c.id,
    nickname: sub.note?.trim() || c.nickname,
    handle: handleOf(c),
    group: sub.group?.trim() || '未分组',
    initial: initialOf(sub.note?.trim() || c.nickname),
    avatarUrl: c.avatarUrl,
    monitoring: !sub.paused,
    intervalMinutes: sub.intervalMinutes,
    lastSync: sub.lastCheckedAt ? formatRelative(sub.lastCheckedAt, now) : '未同步',
    videoCount: c.videoCount,
    sub,
  };
}

export interface WorkbenchData {
  videos: Video[];
  creators: Map<string, CreatorView>;
  creatorList: CreatorView[];
  analyses: Record<string, VideoAnalysis | null>;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  loadAnalysis: (videoId: string) => Promise<VideoAnalysis | null>;
}

export function useWorkbenchData(client: DouyinClient): WorkbenchData {
  const [videos, setVideos] = useState<Video[]>([]);
  const [subs, setSubs] = useState<CreatorSubscription[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, VideoAnalysis | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const now = useMemo(() => Date.now(), [videos, subs]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [all, cs] = await Promise.all([
        client.listRecentVideos(500),
        client.listFollowedCreators(),
      ]);
      // 只保留监听博主的视频；浏览时顺带采集的其它视频留在仓库供下载，但不进列表（避免"未知博主"噪声）。
      const followed = new Set(cs.map((s) => s.creator.id));
      const vs = all.filter((v) => followed.has(v.creatorId));
      setVideos(vs);
      setSubs(cs);
      // 已采集视频的分析按需缓存：并行拉取（个人量级可接受）。
      const entries = await Promise.all(
        vs.map(async (v) => {
          try {
            return [v.id, await client.getAnalysis(v.id)] as const;
          } catch {
            return [v.id, null] as const;
          }
        }),
      );
      setAnalyses(Object.fromEntries(entries));
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadAnalysis = useCallback(
    async (videoId: string) => {
      const a = await client.getAnalysis(videoId);
      setAnalyses((m) => ({ ...m, [videoId]: a }));
      return a;
    },
    [client],
  );

  const creators = useMemo(() => {
    const m = new Map<string, CreatorView>();
    for (const s of subs) m.set(s.creator.id, toCreatorView(s, now));
    return m;
  }, [subs, now]);

  const creatorList = useMemo(() => Array.from(creators.values()), [creators]);

  return { videos, creators, creatorList, analyses, loading, error, reload, loadAnalysis };
}
