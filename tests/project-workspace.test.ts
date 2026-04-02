import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearCurrentProject,
  getCurrentProjectDir,
  getRecentProjects,
  rememberRecentProject,
  setCurrentProjectDir,
} from '../src/store/timeline';

function createStorageMock() {
  const storage = new Map<string, string>();

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

describe('project workspace helpers', () => {
  beforeEach(() => {
    const localStorage = createStorageMock();
    vi.stubGlobal('window', {
      localStorage,
    });
    localStorage.clear();
  });

  it('stores and reorders recent projects', () => {
    rememberRecentProject('/tmp/project-a');
    rememberRecentProject('/tmp/project-b');
    rememberRecentProject('/tmp/project-a');

    expect(getRecentProjects().map((project) => project.path)).toEqual([
      '/tmp/project-a',
      '/tmp/project-b',
    ]);
    expect(getRecentProjects()[0]?.name).toBe('project-a');
  });

  it('clears the active project without deleting recent projects', () => {
    setCurrentProjectDir('/tmp/project-a');
    rememberRecentProject('/tmp/project-a');

    clearCurrentProject();

    expect(getCurrentProjectDir()).toBe('');
    expect(getRecentProjects().map((project) => project.path)).toEqual(['/tmp/project-a']);
  });
});
