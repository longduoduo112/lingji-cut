import { describe, expect, it, vi } from 'vitest';

import {
  ensureRemotionDownloadsCwd,
  getRemotionPackageCandidates,
  resolveRemotionBinariesDirectory,
} from '../electron/remotion-paths';

describe('remotion runtime binary path resolution', () => {
  it('returns the expected compositor packages for darwin arm64', () => {
    expect(getRemotionPackageCandidates('darwin', 'arm64')).toEqual([
      '@remotion/compositor-darwin-arm64',
    ]);
  });

  it('prefers app.asar.unpacked binaries in packaged apps', () => {
    const hitPaths = new Set([
      '/app/Contents/Resources/app.asar.unpacked/node_modules/@remotion/compositor-darwin-arm64/remotion',
    ]);

    const resolved = resolveRemotionBinariesDirectory({
      appPath: '/app/Contents/Resources/app.asar',
      cwd: '/workspace',
      moduleDir: '/app/Contents/Resources/app.asar/dist-electron',
      platform: 'darwin',
      arch: 'arm64',
      existsSync: (candidate) => hitPaths.has(candidate),
    });

    expect(resolved).toBe(
      '/app/Contents/Resources/app.asar.unpacked/node_modules/@remotion/compositor-darwin-arm64',
    );
  });

  it('falls back to cwd node_modules in development', () => {
    const hitPaths = new Set([
      '/workspace/node_modules/@remotion/compositor-darwin-arm64/remotion',
    ]);

    const resolved = resolveRemotionBinariesDirectory({
      appPath: '/workspace',
      cwd: '/workspace',
      moduleDir: '/workspace/dist-electron',
      platform: 'darwin',
      arch: 'arm64',
      existsSync: (candidate) => hitPaths.has(candidate),
    });

    expect(resolved).toBe(
      '/workspace/node_modules/@remotion/compositor-darwin-arm64',
    );
  });
});

describe('ensureRemotionDownloadsCwd', () => {
  it('creates cache dir, stub package.json and chdirs when empty', () => {
    const existing = new Set<string>();
    const mkdirSync = vi.fn((p: string) => {
      existing.add(p);
    });
    const writeFileSync = vi.fn((p: string) => {
      existing.add(p);
    });
    const chdir = vi.fn();

    const result = ensureRemotionDownloadsCwd({
      userDataPath: '/Users/tester/Library/Application Support/lingji',
      existsSync: (p) => existing.has(p),
      mkdirSync,
      writeFileSync,
      chdir,
    });

    const expectedRoot =
      '/Users/tester/Library/Application Support/lingji/remotion-downloads';
    expect(result).toBe(expectedRoot);
    expect(mkdirSync).toHaveBeenCalledWith(expectedRoot, { recursive: true });
    expect(mkdirSync).toHaveBeenCalledWith(
      `${expectedRoot}/node_modules`,
      { recursive: true },
    );
    expect(writeFileSync).toHaveBeenCalledWith(
      `${expectedRoot}/package.json`,
      expect.stringContaining('"lingji-remotion-cache"'),
    );
    expect(chdir).toHaveBeenCalledWith(expectedRoot);
  });

  it('skips recreating files when cache already exists', () => {
    const existing = new Set<string>([
      '/data/remotion-downloads',
      '/data/remotion-downloads/package.json',
      '/data/remotion-downloads/node_modules',
    ]);
    const mkdirSync = vi.fn();
    const writeFileSync = vi.fn();
    const chdir = vi.fn();

    ensureRemotionDownloadsCwd({
      userDataPath: '/data',
      existsSync: (p) => existing.has(p),
      mkdirSync,
      writeFileSync,
      chdir,
    });

    expect(mkdirSync).not.toHaveBeenCalled();
    expect(writeFileSync).not.toHaveBeenCalled();
    expect(chdir).toHaveBeenCalledWith('/data/remotion-downloads');
  });
});
