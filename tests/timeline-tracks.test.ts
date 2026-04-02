import { describe, expect, it } from 'vitest';
import { getRenderableOverlays } from '../src/lib/timeline-tracks';
import { createDefaultTimeline, createVisualTrack } from '../src/types';

describe('getRenderableOverlays', () => {
  it('renders lower-order visual tracks first so higher-order tracks can cover them', () => {
    const timeline = createDefaultTimeline();
    timeline.tracks = [
      timeline.tracks[0],
      timeline.tracks[1],
      createVisualTrack(1, 1),
      createVisualTrack(2, 2),
    ];
    timeline.overlays = [
      {
        id: 'top-layer',
        type: 'image',
        assetPath: '/tmp/top.png',
        trackId: 'visual-2',
        startMs: 0,
        durationMs: 3000,
        position: { x: 0, y: 0, width: 1920, height: 1080 },
      },
      {
        id: 'base-layer',
        type: 'image',
        assetPath: '/tmp/base.png',
        trackId: 'visual-1',
        startMs: 0,
        durationMs: 3000,
        position: { x: 0, y: 0, width: 1920, height: 1080 },
      },
    ];

    expect(getRenderableOverlays(timeline).map((overlay) => overlay.id)).toEqual([
      'base-layer',
      'top-layer',
    ]);
  });
});
