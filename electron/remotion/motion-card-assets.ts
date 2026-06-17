import fs from 'node:fs/promises';
import path from 'node:path';
import type { TimelineData } from '../../src/types';
import type { HyperframesAssetDescriptor } from '../../src/hyperframes/assets';

const CSS_URL_PATTERN = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

export function extractMotionCardAssetReferences(tsx: string): string[] {
  const references = new Set<string>();
  for (const match of tsx.matchAll(CSS_URL_PATTERN)) {
    const value = match[2]?.trim();
    if (!value || /^(?:data:|https?:|file:|\/)/i.test(value)) continue;
    references.add(value.replace(/\\/g, '/').replace(/^\.\//, ''));
  }
  return [...references];
}

export function rewriteMotionCardAssetReferences(tsx: string): string {
  return tsx.replace(CSS_URL_PATTERN, (match, quote: string, rawValue: string) => {
    const value = rawValue.trim();
    if (!value || /^(?:data:|https?:|file:|\/)/i.test(value)) return match;
    const normalized = value.replace(/\\/g, '/').replace(/^\.\//, '');
    return `url(${quote}/public/${normalized}${quote})`;
  });
}

export async function collectMotionCardAssets(
  timeline: TimelineData,
  projectDir: string | null,
): Promise<HyperframesAssetDescriptor[]> {
  if (!projectDir) return [];

  const root = path.resolve(projectDir);
  const assets = new Map<string, HyperframesAssetDescriptor>();
  for (const overlay of timeline.overlays) {
    const tsxPath = overlay.aiCardData?.motionCard?.tsxPath;
    if (!tsxPath) continue;

    let tsx: string;
    try {
      tsx = await fs.readFile(path.join(root, tsxPath), 'utf8');
    } catch {
      continue;
    }

    for (const publicPath of extractMotionCardAssetReferences(tsx)) {
      const sourcePath = path.resolve(root, publicPath);
      if (!sourcePath.startsWith(`${root}${path.sep}`)) continue;
      try {
        await fs.access(sourcePath);
        assets.set(publicPath, { sourcePath, publicPath });
      } catch {
        // Missing optional card artwork should not block the whole export.
      }
    }
  }
  return [...assets.values()];
}
