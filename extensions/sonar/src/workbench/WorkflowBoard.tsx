/** 工作流：三列本地看板（待处理 / 处理中 / 已完成），引用视频，支持移动状态、打开详情、移除。 */
import { useEffect, useState } from 'react';
import type { DouyinClient } from '@/client';
import type { WorkflowItem, WorkflowStatus } from '@/domain/models';
import { S } from '@/ui/theme';
import { StanceBadge, useHover } from '@/ui/kit';
import type { WorkbenchData } from './use-data';
import { errText } from './use-data';

const COLS: Array<{ status: WorkflowStatus; label: string; next?: WorkflowStatus; prev?: WorkflowStatus }> = [
  { status: 'todo', label: '待处理', next: 'in_progress' },
  { status: 'in_progress', label: '处理中', next: 'done', prev: 'todo' },
  { status: 'done', label: '已完成', prev: 'in_progress' },
];

export function WorkflowBoard({
  client,
  data,
  onOpen,
  show,
}: {
  client: DouyinClient;
  data: WorkbenchData;
  onOpen: (videoId: string) => void;
  show: (t: string) => void;
}) {
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const load = () => client.listWorkflowItems().then(setItems).catch((e) => show(errText(e)));
  useEffect(() => {
    void load();
  }, []);

  const move = async (item: WorkflowItem, status: WorkflowStatus) => {
    try {
      await client.updateWorkflowItem({ id: item.id, status });
      await load();
    } catch (e) {
      show(errText(e));
    }
  };

  return (
    <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: S.shell }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '22px 32px 60px' }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 21, fontWeight: 700, color: S.white, letterSpacing: '-.2px' }}>工作流</div>
          <div style={{ fontSize: 12.5, color: S.faint, marginTop: 3 }}>本地看板 · 从视频详情「加入工作流」收集，不触发自动发布</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, alignItems: 'start' }}>
          {COLS.map((col) => {
            const colItems = items.filter((i) => i.status === col.status);
            return (
              <div key={col.status} style={{ background: S.card, border: '.5px solid rgba(255,255,255,.07)', borderRadius: 14, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: S.faint, letterSpacing: '.5px', textTransform: 'uppercase' }}>{col.label}</span>
                  <span style={{ fontSize: 11, color: S.faint3, fontFamily: S.mono }}>{colItems.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {colItems.length === 0 && <div style={{ fontSize: 12, color: S.faint3, padding: '12px 0', textAlign: 'center' }}>暂无</div>}
                  {colItems.map((item) => {
                    const v = data.videos.find((x) => x.id === item.videoId);
                    return (
                      <ItemCard
                        key={item.id}
                        title={v?.description || item.videoId}
                        creatorName={v ? data.creators.get(v.creatorId)?.nickname ?? '未知博主' : ''}
                        category={data.analyses[item.videoId]?.category}
                        prevLabel={col.prev && COLS.find((c) => c.status === col.prev)?.label}
                        nextLabel={col.next && COLS.find((c) => c.status === col.next)?.label}
                        onOpen={() => onOpen(item.videoId)}
                        onPrev={col.prev ? () => move(item, col.prev!) : undefined}
                        onNext={col.next ? () => move(item, col.next!) : undefined}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ItemCard({
  title,
  creatorName,
  category,
  prevLabel,
  nextLabel,
  onOpen,
  onPrev,
  onNext,
}: {
  title: string;
  creatorName: string;
  category?: string;
  prevLabel?: string;
  nextLabel?: string;
  onOpen: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const [h, bind] = useHover();
  return (
    <div style={{ background: S.card2, border: '.5px solid rgba(255,255,255,.06)', borderRadius: 11, padding: 12, ...(h ? { borderColor: 'rgba(255,255,255,.14)' } : null) }} {...bind}>
      <div onClick={onOpen} style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: S.dim }}>{creatorName}</span>
          <StanceBadge category={category} style={{ marginLeft: 'auto' }} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: S.e8, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{title}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {onPrev && (
          <button onClick={onPrev} style={moveBtn}>
            ← {prevLabel}
          </button>
        )}
        <div style={{ flex: 1 }} />
        {onNext && (
          <button onClick={onNext} style={moveBtn}>
            {nextLabel} →
          </button>
        )}
      </div>
    </div>
  );
}

const moveBtn = {
  fontSize: 11.5,
  color: S.cf,
  background: 'rgba(255,255,255,.06)',
  border: '.5px solid rgba(255,255,255,.09)',
  borderRadius: 7,
  padding: '5px 10px',
  cursor: 'pointer',
} as const;
