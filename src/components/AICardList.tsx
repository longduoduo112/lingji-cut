import type { CSSProperties } from 'react';
import { formatTime } from '../lib/utils';
import type { AICard, AICardType } from '../types/ai';
import { AppIcon, type AppIconName } from './AppIcon';
import { Badge, Button, IconButton, SurfaceCard } from '../ui/primitives';
import styles from './AICardList.module.css';

export interface AICardPlacement {
  trackId: string;
  trackLabel: string;
}

interface AICardListProps {
  cards: AICard[];
  placements?: Record<string, AICardPlacement>;
  onToggleEnabled: (cardId: string) => void;
  onDeleteCard: (cardId: string) => void;
  onEditCard: (cardId: string) => void;
}

const CARD_TYPE_META: Record<AICardType, { label: string; color: string; icon: AppIconName }> = {
  summary: { label: '摘要', color: '#6366f1', icon: 'file-text' },
  data: { label: '数据', color: '#10b981', icon: 'chart-column' },
  insight: { label: '观点', color: '#f59e0b', icon: 'lightbulb' },
  chapter: { label: '章节', color: '#8b5cf6', icon: 'book-open-text' },
  quote: { label: '金句', color: '#ec4899', icon: 'quote' },
};

export function AICardList({
  cards,
  placements = {},
  onToggleEnabled,
  onDeleteCard,
  onEditCard,
}: AICardListProps) {
  return (
    <div className={styles.list}>
      {cards.map((card) => {
        const meta = CARD_TYPE_META[card.type];
        const placement = placements[card.id];
        const placementText = placement ? `已在${placement.trackLabel}` : '未上轨';

        return (
          <SurfaceCard
            key={card.id}
            variant="subtle"
            padding="sm"
            interactive
            onClick={() => onEditCard(card.id)}
            className={styles.card}
            data-enabled={card.enabled}
            style={createCardAccentStyle(meta.color)}
          >
            <div className={styles.cardRow}>
              <div className={styles.iconChip} title={meta.label}>
                <AppIcon name={meta.icon} size={14} />
              </div>

              <div className={styles.content}>
                <div className={styles.header}>
                  <IconButton
                    aria-label={card.enabled ? `取消选择卡片 ${card.title}` : `选择卡片 ${card.title}`}
                    title={card.enabled ? '已选' : '未选'}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleEnabled(card.id);
                    }}
                    variant={card.enabled ? 'brand' : 'ghost'}
                    size="sm"
                    className={styles.toggleButton}
                    data-enabled={card.enabled}
                  >
                    <AppIcon name={card.enabled ? 'circle-check-big' : 'circle'} size={15} />
                  </IconButton>
                  <div className={styles.title}>{card.title}</div>
                </div>

                <div className={styles.meta}>
                  {formatTime(card.startMs)} - {formatTime(card.endMs)}
                </div>
                <div className={styles.placement}>
                  <Badge variant={placement ? 'info' : 'neutral'}>{placementText}</Badge>
                </div>
              </div>

              <Button
                aria-label={`删除卡片 ${card.title}`}
                title="删除卡片"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteCard(card.id);
                }}
                variant="danger"
                size="sm"
                className={styles.deleteButton}
              >
                删除
              </Button>
            </div>
          </SurfaceCard>
        );
      })}
    </div>
  );
}

function createCardAccentStyle(color: string): CSSProperties {
  return {
    ['--card-accent' as string]: color,
  };
}
