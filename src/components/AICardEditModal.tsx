import type { AICard } from '../types/ai';
import { Button, ModalShell } from '../ui/primitives';
import { AICardInspector } from './AICardInspector';

interface AICardEditModalProps {
  visible: boolean;
  card: AICard | null;
  isRegenerating?: boolean;
  previewWidth?: number;
  previewHeight?: number;
  onClose: () => void;
  onRegenerate: (updates: Partial<AICard>) => Promise<AICard | null>;
  onSave: (cardId: string, updates: Partial<AICard>) => void;
}

export function AICardEditModal({
  visible,
  card,
  isRegenerating = false,
  previewWidth = 1_920,
  previewHeight = 1_080,
  onClose,
  onRegenerate,
  onSave,
}: AICardEditModalProps) {
  if (!visible || !card) {
    return null;
  }

  return (
    <ModalShell
      visible={visible}
      eyebrow="EDIT CARD"
      title="编辑卡片"
      size="lg"
      zIndex={160}
      footer={
        <Button variant="secondary" onClick={onClose}>
          关闭
        </Button>
      }
    >
      <AICardInspector
        card={card}
        isRegenerating={isRegenerating}
        previewWidth={previewWidth}
        previewHeight={previewHeight}
        showCancel
        onCancel={onClose}
        onRegenerate={onRegenerate}
        onSave={(cardId, updates) => {
          onSave(cardId, updates);
          onClose();
        }}
      />
    </ModalShell>
  );
}
