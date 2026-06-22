import { describe, expect, it } from 'vitest';
import { resolvePageTransition } from '../src/lib/page-transition';

describe('resolvePageTransition', () => {
  it('enables a soft fade transition only when closing a project back to welcome', () => {
    const result = resolvePageTransition({
      fromPage: 'editor',
      toPage: 'welcome',
      reason: 'close-project',
      reducedMotion: false,
    });

    expect(result.enabled).toBe(true);
    expect(result.contentKey).toBe('close-project:editor->welcome');
    expect(result.initial).toMatchObject({ opacity: 0, y: 8 });
    expect(result.animate).toMatchObject({ opacity: 1, y: 0 });
    expect(result.exit).toMatchObject({ opacity: 0, y: 10 });
    expect(result.transition.duration).toBeGreaterThan(0);
  });

  it('uses a sheet-from-top transition when entering the settings page', () => {
    const result = resolvePageTransition({
      fromPage: 'welcome',
      toPage: 'settings',
      reason: 'default',
      reducedMotion: false,
    });

    expect(result.enabled).toBe(true);
    expect(result.contentKey).toBe('to-settings:welcome');
    expect(result.initial).toMatchObject({ opacity: 0, y: -6 });
    expect(result.animate).toMatchObject({ opacity: 1, y: 0 });
    expect(result.exit).toMatchObject({ opacity: 0, y: -4 });
    expect(result.transition.duration).toBeGreaterThan(0);
  });

  it('keeps a stable contentKey for switches inside the workspace (no exit/remount)', () => {
    // 写稿/编辑器/发布三页同属一棵常驻子树，用 CSS display 切换显隐。
    // contentKey 必须稳定，否则 AnimatePresence mode="wait" 会触发 exit→remount，
    // 在 framer-motion v12 时序竞态下卡成空白。
    const editorToWorkbench = resolvePageTransition({
      fromPage: 'editor',
      toPage: 'script-workbench',
      reason: 'default',
      reducedMotion: false,
    });

    expect(editorToWorkbench.enabled).toBe(false);
    expect(editorToWorkbench.contentKey).toBe('workspace');

    const workbenchToPublish = resolvePageTransition({
      fromPage: 'script-workbench',
      toPage: 'publish',
      reason: 'default',
      reducedMotion: false,
    });

    expect(workbenchToPublish.enabled).toBe(false);
    expect(workbenchToPublish.contentKey).toBe('workspace');

    // 稳定的 key 意味着同一棵子树不会因切换 tab 而被 AnimatePresence 重新挂载
    expect(workbenchToPublish.contentKey).toBe(editorToWorkbench.contentKey);
  });

  it('still crossfades when entering or leaving the workspace', () => {
    // 跨类别切换（welcome ↔ workspace、workspace → settings）仍需正常动画
    const welcomeToWorkbench = resolvePageTransition({
      fromPage: 'welcome',
      toPage: 'script-workbench',
      reason: 'default',
      reducedMotion: false,
    });

    expect(welcomeToWorkbench.enabled).toBe(true);
    expect(welcomeToWorkbench.contentKey).toBe('crossfade:welcome->script-workbench');

    const editorToSettings = resolvePageTransition({
      fromPage: 'editor',
      toPage: 'settings',
      reason: 'default',
      reducedMotion: false,
    });

    expect(editorToSettings.enabled).toBe(true);
    expect(editorToSettings.contentKey).toBe('to-settings:editor');
  });

  it('disables the close-project transition when reduced motion is preferred', () => {
    const result = resolvePageTransition({
      fromPage: 'script-workbench',
      toPage: 'welcome',
      reason: 'close-project',
      reducedMotion: true,
    });

    expect(result.enabled).toBe(false);
    expect(result.transition.duration).toBe(0);
  });
});
