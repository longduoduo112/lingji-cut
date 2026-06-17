import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectMotionCardAssets,
  extractMotionCardAssetReferences,
  rewriteMotionCardAssetReferences,
} from '../electron/remotion/motion-card-assets';

describe('motion card export assets', () => {
  it('extracts unique local CSS url references', () => {
    const refs = extractMotionCardAssetReferences(`
      const bg = "url('ai-cards/backgrounds/a.png')";
      const duplicate = 'url("ai-cards/backgrounds/a.png")';
      const remote = "url(https://example.com/b.png)";
      const inline = "url(data:image/png;base64,abc)";
    `);
    expect(refs).toEqual(['ai-cards/backgrounds/a.png']);
  });

  it('rewrites only local CSS urls to the Remotion public prefix', () => {
    expect(rewriteMotionCardAssetReferences(`url('ai-cards/backgrounds/a.png')`))
      .toBe(`url('/public/ai-cards/backgrounds/a.png')`);
    expect(rewriteMotionCardAssetReferences(`url("https://example.com/b.png")`))
      .toBe(`url("https://example.com/b.png")`);
    expect(rewriteMotionCardAssetReferences(`url(data:image/png;base64,abc)`))
      .toBe(`url(data:image/png;base64,abc)`);
  });

  it('collects existing assets referenced by external motion cards', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'lingji-card-assets-'));
    try {
      const cardDir = path.join(dir, 'ai-cards', 'card-1');
      const backgroundDir = path.join(dir, 'ai-cards', 'backgrounds');
      await mkdir(cardDir, { recursive: true });
      await mkdir(backgroundDir, { recursive: true });
      await writeFile(path.join(backgroundDir, 'hero.png'), 'image');
      await writeFile(
        path.join(cardDir, 'motionCard.tsx'),
        `export default () => <div style={{background:"url('ai-cards/backgrounds/hero.png')"}} />`,
      );

      const timeline = {
        overlays: [{
          id: 'card-1',
          aiCardData: {
            motionCard: { tsxPath: 'ai-cards/card-1/motionCard.tsx' },
          },
        }],
      } as never;

      await expect(collectMotionCardAssets(timeline, dir)).resolves.toEqual([{
        sourcePath: path.join(backgroundDir, 'hero.png'),
        publicPath: 'ai-cards/backgrounds/hero.png',
      }]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
