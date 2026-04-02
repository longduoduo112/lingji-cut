import { describe, expect, it } from 'vitest';
import { shouldUpdatePlaybackTime } from '../src/lib/playback';

describe('shouldUpdatePlaybackTime', () => {
  it('skips tiny forward frame updates to avoid thrashing the preview', () => {
    expect(shouldUpdatePlaybackTime(1000, 1033)).toBe(false);
    expect(shouldUpdatePlaybackTime(1000, 1199)).toBe(false);
  });

  it('publishes meaningful forward progress updates', () => {
    expect(shouldUpdatePlaybackTime(1000, 1250)).toBe(true);
    expect(shouldUpdatePlaybackTime(1000, 1350)).toBe(true);
  });

  it('always updates when playback jumps backwards', () => {
    expect(shouldUpdatePlaybackTime(1000, 950)).toBe(true);
    expect(shouldUpdatePlaybackTime(1000, 0)).toBe(true);
  });
});
