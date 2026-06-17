import fs from 'node:fs/promises';
import path from 'node:path';
import type { AISettings } from '../../src/types/ai';
import { buildPiModelsJson, buildPiSettingsJson } from './pi-provider-projection';

/** 把 App AISettings 投影并写入 pi 配置目录（settings.json + models.json）。 */
export async function writePiConfig(configDir: string, ai: AISettings): Promise<void> {
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(
    path.join(configDir, 'models.json'),
    JSON.stringify(buildPiModelsJson(ai), null, 2),
    'utf-8',
  );
  await fs.writeFile(
    path.join(configDir, 'settings.json'),
    JSON.stringify(buildPiSettingsJson(ai), null, 2),
    'utf-8',
  );
}
