import { useEffect, useState } from 'react';
import { Palette } from 'lucide-react';
import { loadAISettings, saveAISettings } from '../../store/ai';
import { SettingsPageHeader } from '../../ui';
import { StyleLibraryPanel } from '../StyleLibraryPanel';
import { resolveStylePresetId } from '../../lib/card-style';
import type { AISettings } from '../../types/ai';

export function StyleLibraryTab() {
  const [settings, setSettings] = useState<AISettings | null>(null);

  useEffect(() => {
    void loadAISettings().then((loaded) => {
      setSettings(loaded);
    });
  }, []);

  const handleChange = (id: string) => {
    void loadAISettings().then((current) => {
      if (!current) return;
      const next: AISettings = { ...current, defaultStylePresetId: id };
      void saveAISettings(next).then(() => {
        setSettings(next);
      });
    });
  };

  return (
    <div>
      <SettingsPageHeader
        leading={<Palette size={22} />}
        title="风格库"
        description="选择全局默认的卡片视觉风格，应用于段落信息卡、封面图与图片卡的生成。项目与单卡可在编辑器中单独覆盖。"
      />
      <StyleLibraryPanel
        value={resolveStylePresetId({ global: settings?.defaultStylePresetId })}
        onChange={handleChange}
      />
    </div>
  );
}
