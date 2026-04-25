import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import packageJson from '../package.json';

describe('package runtime dependencies', () => {
  it('keeps Remotion runtime dependencies in dependencies for Electron packaging', () => {
    expect(packageJson.dependencies?.react).toBeTruthy();
    expect(packageJson.dependencies?.['react-dom']).toBeTruthy();
    expect(packageJson.dependencies?.chokidar).toBeTruthy();
  });

  it('keeps China-friendly binary mirrors in project npm config', () => {
    const npmrc = fs.readFileSync(path.resolve(__dirname, '../.npmrc'), 'utf8');

    expect(npmrc).toContain('registry=https://registry.npmmirror.com/');
    expect(npmrc).toContain('electron_mirror=https://npmmirror.com/mirrors/electron/');
    expect(npmrc).toContain('disturl=https://npmmirror.com/mirrors/node/');
    expect(npmrc).toContain('sharp_binary_host=https://npmmirror.com/mirrors/sharp/');
  });
});
