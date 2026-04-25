import path from 'node:path';
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
    const hitPath = path.posix.join(
      '/app/Contents/Resources/app.asar.unpacked',
      'node_modules',
      '@remotion/compositor-darwin-arm64',
      'remotion',
    );
    const hitPaths = new Set([hitPath]);

    const resolved = resolveRemotionBinariesDirectory({
      appPath: '/app/Contents/Resources/app.asar',
      cwd: '/workspace',
      moduleDir: '/app/Contents/Resources/app.asar/dist-electron',
      platform: 'darwin',
      arch: 'arm64',
      existsSync: (candidate) => hitPaths.has(candidate),
    });

    expect(resolved).toBe(path.posix.dirname(hitPath));
  });

  it('falls back to cwd node_modules in development', () => {
    const hitPath = path.posix.join(
      '/workspace',
      'node_modules',
      '@remotion/compositor-darwin-arm64',
      'remotion',
    );
    const hitPaths = new Set([hitPath]);

    const resolved = resolveRemotionBinariesDirectory({
      appPath: '/workspace',
      cwd: '/workspace',
      moduleDir: '/workspace/dist-electron',
      platform: 'darwin',
      arch: 'arm64',
      existsSync: (candidate) => hitPaths.has(candidate),
    });

    expect(resolved).toBe(path.posix.dirname(hitPath));
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

    const expectedRoot = path.join(
      '/Users/tester/Library/Application Support/lingji',
      'remotion-downloads',
    );
    expect(result).toBe(expectedRoot);
    expect(mkdirSync).toHaveBeenCalledWith(expectedRoot, { recursive: true });
    expect(mkdirSync).toHaveBeenCalledWith(
      path.join(expectedRoot, 'node_modules'),
      { recursive: true },
    );
    expect(writeFileSync).toHaveBeenCalledWith(
      path.join(expectedRoot, 'package.json'),
      expect.stringContaining('"lingji-remotion-cache"'),
    );
    expect(chdir).toHaveBeenCalledWith(expectedRoot);
  });

  it('skips recreating files when cache already exists', () => {
    const existing = new Set<string>([
      path.join('/data', 'remotion-downloads'),
      path.join('/data', 'remotion-downloads', 'package.json'),
      path.join('/data', 'remotion-downloads', 'node_modules'),
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
    expect(chdir).toHaveBeenCalledWith(path.join('/data', 'remotion-downloads'));
  });
});
