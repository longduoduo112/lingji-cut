import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  createProject,
  getProjectState,
  openProject,
} from '../electron/pipeline/tools/project-tools';

function tmpRoot(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'lingji-cp-'));
}

describe('createProject', () => {
  let root: string;
  beforeEach(() => { root = tmpRoot(); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it('rejects relative paths', async () => {
    await expect(createProject({ path: 'foo' })).rejects.toMatchObject({
      code: 'invalid_project',
    });
  });

  it('creates project skeleton in fresh directory', async () => {
    const target = path.join(root, 'p1');
    const out = await createProject({ path: target });
    expect(out.projectPath).toBe(target);
    expect(existsSync(path.join(target, 'project.json'))).toBe(true);
    expect(existsSync(path.join(target, 'original.md'))).toBe(true);
    expect(existsSync(path.join(target, 'covers'))).toBe(true);
    expect(existsSync(path.join(target, 'ai-cards'))).toBe(true);
    expect(existsSync(path.join(target, 'configs/prompts'))).toBe(true);
    expect(existsSync(path.join(target, 'script.md'))).toBe(false);
    const data = JSON.parse(readFileSync(path.join(target, 'project.json'), 'utf-8'));
    expect(data.version).toBe(1);
    expect(data.timeline).toBeNull();
  });

  it('rejects non-empty existing directory', async () => {
    const target = path.join(root, 'p2');
    mkdirSync(target);
    writeFileSync(path.join(target, 'rogue.txt'), 'x');
    await expect(createProject({ path: target })).rejects.toMatchObject({
      code: 'invalid_project',
    });
  });

  it('accepts empty existing directory', async () => {
    const target = path.join(root, 'p3');
    mkdirSync(target);
    const out = await createProject({ path: target });
    expect(out.projectPath).toBe(target);
    expect(existsSync(path.join(target, 'project.json'))).toBe(true);
  });
});

describe('getProjectState', () => {
  let root: string;
  beforeEach(() => { root = tmpRoot(); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it('reflects fresh skeleton (all-false)', async () => {
    const target = path.join(root, 'p');
    await createProject({ path: target });
    const s = await getProjectState({ projectPath: target });
    expect(s.has_original).toBe(false);
    expect(s.has_audio).toBe(false);
    expect(s.last_export).toBeNull();
  });

  it('detects original.md after writing content', async () => {
    const target = path.join(root, 'p');
    await createProject({ path: target });
    writeFileSync(path.join(target, 'original.md'), 'hi');
    const s = await getProjectState({ projectPath: target });
    expect(s.has_original).toBe(true);
  });
});

describe('openProject', () => {
  let root: string;
  beforeEach(() => { root = tmpRoot(); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it('returns ok for an existing project', async () => {
    const target = path.join(root, 'p');
    await createProject({ path: target });
    expect(await openProject({ path: target })).toEqual({ ok: true });
  });

  it('throws project_not_found for nonexistent path', async () => {
    await expect(openProject({ path: path.join(root, 'missing') })).rejects.toMatchObject({
      code: 'project_not_found',
    });
  });
});
