import type { BrowserContext } from 'playwright';
import { applyStealth } from './stealth';

interface ContextOpts {
  storageStatePath?: string;
  headless: boolean;
}

// playwrightModule 仅供测试注入；生产用 dynamic import('playwright')
export async function withContext<T>(
  opts: ContextOpts,
  run: (ctx: BrowserContext) => Promise<T>,
  playwrightModule?: any,
): Promise<T> {
  const pw = playwrightModule ?? (await import('playwright'));
  const browser = await pw.chromium.launch({ headless: opts.headless });
  try {
    const context = await browser.newContext(
      opts.storageStatePath ? { storageState: opts.storageStatePath } : {},
    );
    await applyStealth(context);
    try {
      return await run(context);
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
