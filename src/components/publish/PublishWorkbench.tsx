import { useEffect } from 'react';
import { usePublishStore } from '../../store/publish';

export function PublishWorkbench({ projectDir }: { projectDir: string | null }) {
  const loadAccounts = usePublishStore((s) => s.loadAccounts);
  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);
  return (
    <div style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      <h2>发布视频</h2>
      <p style={{ color: 'var(--color-text-secondary)' }}>工程目录：{projectDir ?? '未打开'}</p>
    </div>
  );
}
