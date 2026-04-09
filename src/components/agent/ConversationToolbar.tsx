import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '../../ui';

interface ConversationToolbarProps {
  disabled?: boolean;
  loading?: boolean;
  onCreateConversation: () => void;
  onRefresh: () => void;
}

export function ConversationToolbar({
  disabled = false,
  loading = false,
  onCreateConversation,
  onRefresh,
}: ConversationToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-mac-separator shrink-0">
      <Button
        variant="primary"
        size="sm"
        onClick={onCreateConversation}
        disabled={disabled}
        className="flex-1"
      >
        <Plus size={14} />
        新建会话
      </Button>
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        onClick={onRefresh}
        disabled={loading}
        title="刷新会话列表"
      >
        <RefreshCw size={14} />
      </Button>
    </div>
  );
}
