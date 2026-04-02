import { useCallback, useState } from 'react';
import type { AssetItem, AssetType } from '../types';
import { useTimelineStore } from '../store/timeline';
import { AssetCard } from './AssetCard';

type AssetFilterKey = 'all' | AssetType;

const FILTER_OPTIONS: Array<{ key: AssetFilterKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'audio', label: '音频' },
  { key: 'srt', label: '字幕' },
];

function matchesAssetFilter(asset: AssetItem, filter: AssetFilterKey, keyword: string): boolean {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (filter !== 'all' && asset.type !== filter) {
    return false;
  }

  if (!normalizedKeyword) {
    return true;
  }

  return asset.name.toLowerCase().includes(normalizedKeyword);
}

export function AssetPanel({
  compact,
  railHeight,
  onAddAsset,
}: {
  compact: boolean;
  railHeight?: number;
  onAddAsset?: () => Promise<void>;
}) {
  const { addAsset, assets, removeAsset, timeline } = useTimelineStore();
  const [keyword, setKeyword] = useState('');
  const [activeFilter, setActiveFilter] = useState<AssetFilterKey>('all');

  const handleAddAsset = useCallback(async () => {
    if (onAddAsset) {
      await onAddAsset();
      return;
    }

    const asset = await window.electronAPI.addAsset();
    if (!asset) {
      return;
    }

    addAsset(asset.path, asset.type, asset.durationMs);
  }, [addAsset, onAddAsset]);

  const getAssetUsageCount = useCallback(
    (path: string) => timeline.overlays.filter((overlay) => overlay.assetPath === path).length,
    [timeline.overlays],
  );

  const handleRemoveAsset = useCallback(
    (path: string) => {
      const usageCount = getAssetUsageCount(path);
      if (
        usageCount > 0 &&
        !window.confirm(`该素材已在底部轨道中使用 ${usageCount} 次，删除后会同步移除所有相关轨道块。确认继续吗？`)
      ) {
        return;
      }

      removeAsset(path);
    },
    [getAssetUsageCount, removeAsset],
  );

  const visibleAssets = assets.filter((asset) => matchesAssetFilter(asset, activeFilter, compact ? '' : keyword));

  const emptyMessage = assets.length === 0 ? '还没有素材。先导入图片、视频、音频或字幕文件。' : '没有匹配的素材，试试别的关键词。';

  return (
    <aside
      style={{
        flex: 1,
        minHeight: 0,
        borderLeft: compact ? 'none' : '1px solid rgba(255,255,255,0.08)',
        borderTop: compact ? '1px solid rgba(255,255,255,0.08)' : 'none',
        background: 'rgba(21, 23, 28, 0.98)',
        padding: compact ? 12 : 14,
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 10 : 12,
        maxHeight: '100%',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minWidth: 0,
        }}
      >
        <button
          type="button"
          onClick={handleAddAsset}
          style={{
            height: 38,
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.08)',
            color: '#f4f7fb',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 700,
            padding: compact ? '0 12px' : '0 14px',
            whiteSpace: 'nowrap',
          }}
        >
          + 导入
        </button>
        {compact ? (
          <div
            style={{
              minWidth: 0,
              flex: 1,
              color: '#a8b3c2',
              fontSize: 12,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            素材库 · {visibleAssets.length} 项
          </div>
        ) : (
          <label
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 38,
              padding: '0 12px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(0,0,0,0.18)',
              color: '#8593a7',
            }}
          >
            <span style={{ fontSize: 15, lineHeight: 1 }}>⌕</span>
            <input
              type="search"
              value={keyword}
              aria-label="搜索素材"
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索文件名"
              style={{
                flex: 1,
                minWidth: 0,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#eef4ff',
                fontSize: 13,
              }}
            />
          </label>
        )}
      </div>

      {!compact ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              overflowX: 'auto',
              paddingBottom: 2,
            }}
          >
            {FILTER_OPTIONS.map((option) => {
              const isActive = option.key === activeFilter;

              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setActiveFilter(option.key)}
                  style={{
                    height: 28,
                    padding: '0 10px',
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                    color: isActive ? '#f4f7fb' : '#9aa7b8',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <div
            style={{
              color: '#7f8ca0',
              fontSize: 11,
              whiteSpace: 'nowrap',
            }}
          >
            {visibleAssets.length} 项
          </div>
        </div>
      ) : null}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: compact ? 'hidden' : 'auto',
          overflowX: compact ? 'auto' : 'hidden',
          display: compact ? 'flex' : 'grid',
          gridTemplateColumns: compact ? undefined : 'repeat(2, minmax(0, 1fr))',
          gap: compact ? 12 : 14,
          alignContent: 'start',
          paddingBottom: compact ? 4 : 0,
          paddingRight: compact ? 0 : 4,
        }}
      >
        {visibleAssets.length === 0 ? (
          <div
            style={{
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.03)',
              padding: compact ? 12 : 14,
              color: '#8a97aa',
              fontSize: 12,
              lineHeight: 1.6,
              minWidth: compact ? 220 : 'auto',
              gridColumn: compact ? undefined : '1 / -1',
            }}
          >
            {emptyMessage}
          </div>
        ) : null}

        {visibleAssets.map((asset) => (
          <AssetCard
            key={asset.path}
            asset={asset}
            compact={compact}
            usageCount={getAssetUsageCount(asset.path)}
            onRemove={handleRemoveAsset}
            onDragStart={(event) => {
              if (asset.locked || (asset.type !== 'image' && asset.type !== 'video')) {
                event.preventDefault();
                return;
              }

              event.dataTransfer.effectAllowed = 'copy';
              event.dataTransfer.setData('application/json', JSON.stringify(asset));
            }}
          />
        ))}
      </div>
    </aside>
  );
}
