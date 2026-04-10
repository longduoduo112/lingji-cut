import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App from '../src/App';

vi.mock('../src/ui', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/ui')>();
  return {
    ...original,
    useToast: () => ({ showToast: () => undefined }),
    ToastProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

function createStorageMock(initialEntries: Record<string, string> = {}) {
  const storage = new Map<string, string>(Object.entries(initialEntries));

  return {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
  };
}

describe('App welcome screen', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      innerWidth: 1440,
      innerHeight: 900,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      matchMedia: () => ({
        matches: false,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
      localStorage: createStorageMock({
        'podcast-editor-recent-projects': JSON.stringify([
          {
            path: '/tmp/recent-project',
            name: 'recent-project',
            lastOpenedAt: new Date('2026-04-06T20:30:00+08:00').getTime(),
          },
        ]),
      }),
    });
  });

  it('shows recent project entries on the initial setup screen', () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('最近项目');
    expect(html).toContain('recent-project');
  });
});
