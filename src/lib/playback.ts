export const PLAYBACK_UI_UPDATE_MS = 250;

export function shouldUpdatePlaybackTime(
  previousMs: number,
  nextMs: number,
  thresholdMs = PLAYBACK_UI_UPDATE_MS,
): boolean {
  if (nextMs <= previousMs) {
    return true;
  }

  return nextMs - previousMs >= thresholdMs;
}
