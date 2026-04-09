import { Film, PenLine } from 'lucide-react';
import type { AppPage } from '../lib/electron-api';
import styles from './WorkspaceTabs.module.css';

type WorkspaceTab = 'script-workbench' | 'editor';

interface WorkspaceTabsProps {
  active: WorkspaceTab;
  onSwitch: (tab: WorkspaceTab) => void;
}

const tabs: { key: WorkspaceTab; label: string; icon: React.ReactNode; page: AppPage }[] = [
  { key: 'script-workbench', label: '写稿工作台', icon: <PenLine />, page: 'script-workbench' },
  { key: 'editor', label: '视频编辑器', icon: <Film />, page: 'editor' },
];

export function WorkspaceTabs({ active, onSwitch }: WorkspaceTabsProps) {
  return (
    <nav className={styles.root}>
      {tabs.map((tab, i) => (
        <span key={tab.key} style={{ display: 'contents' }}>
          {i > 0 && <span className={styles.separator} />}
          <button
            type="button"
            className={`${styles.tab} ${active === tab.key ? styles.active : ''}`}
            onClick={() => onSwitch(tab.key)}
          >
            <span className={styles.icon}>{tab.icon}</span>
            {tab.label}
          </button>
        </span>
      ))}
    </nav>
  );
}
