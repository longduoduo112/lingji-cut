import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_VISUAL_TRACK_ID, createDefaultTimeline } from '../src/types';
import {
  prepareTimelineForRemotionRender,
  resolveRemotionAssetSrc,
} from '../src/lib/remotion-assets';

vi.mock('remotion', () => ({
  staticFile: (path: string) => `/static/${path}`,
}));

describe('prepareTimelineForRemotionRender', () => {
  it('rewrites local filesystem media paths into bundled static asset paths', () => {
    const timeline = createDefaultTimeline();
    timeline.podcast.audioPath = '/tmp/audio.mp3';
    timeline.overlays = [
      {
        id: 'overlay-1',
        type: 'image',
        assetPath: '/tmp/cover.png',
        trackId: DEFAULT_VISUAL_TRACK_ID,
        startMs: 0,
        durationMs: 5_000,
        position: { x: 0, y: 0, width: 1920, height: 1080 },
      },
      {
        id: 'overlay-2',
        type: 'video',
        assetPath: 'https://example.com/remote.mp4',
        trackId: DEFAULT_VISUAL_TRACK_ID,
        startMs: 2_000,
        durationMs: 8_000,
        position: { x: 0, y: 0, width: 1920, height: 1080 },
      },
    ];

    const result = prepareTimelineForRemotionRender(timeline);

    expect(result.timeline.podcast.audioPath).toBe('render-assets/audio-0.mp3');
    expect(result.timeline.overlays[0]?.assetPath).toBe('render-assets/overlay-1.png');
    expect(result.timeline.overlays[1]?.assetPath).toBe('https://example.com/remote.mp4');
    expect(result.assets).toEqual([
      {
        sourcePath: '/tmp/audio.mp3',
        publicPath: 'render-assets/audio-0.mp3',
      },
      {
        sourcePath: '/tmp/cover.png',
        publicPath: 'render-assets/overlay-1.png',
      },
    ]);
  });
});

describe('prepareTimelineForRemotionRender — ai-card media', () => {
  it('翻译 image 卡的 assetPath 到 render-assets 并注册资产', () => {
    const timeline = createDefaultTimeline();
    timeline.overlays = [
      {
        id: 'ov1',
        type: 'image',
        overlayType: 'ai-card',
        assetPath: '',
        trackId: DEFAULT_VISUAL_TRACK_ID,
        startMs: 0,
        durationMs: 5_000,
        position: { x: 0, y: 0, width: 1920, height: 1080 },
        aiCardData: {
          sourceCardId: 'c1',
          cardType: 'image',
          title: 't',
          content: {
            mediaType: 'image',
            assetPath: '/abs/projectDir/ai-cards/c1/image.png',
            aspectRatio: '16:9',
            prompt: '',
            providerId: 'p',
            model: 'm',
            generationStatus: 'ready',
          },
          template: 'image-default',
          displayMode: 'fullscreen',
          style: { primaryColor: '#fff', backgroundColor: '#000', fontSize: 48 },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    ];

    const { timeline: out, assets } = prepareTimelineForRemotionRender(timeline);
    expect(assets.some((a) => a.sourcePath === '/abs/projectDir/ai-cards/c1/image.png')).toBe(true);
    const newOverlay = out.overlays[0]!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newPath = (newOverlay.aiCardData!.content as any).assetPath as string;
    expect(newPath.startsWith('render-assets/')).toBe(true);
  });

  it('翻译 video 卡的 assetPath + posterPath', () => {
    const timeline = createDefaultTimeline();
    timeline.overlays = [
      {
        id: 'ov2',
        type: 'video',
        overlayType: 'ai-card',
        assetPath: '',
        trackId: DEFAULT_VISUAL_TRACK_ID,
        startMs: 0,
        durationMs: 6_000,
        position: { x: 0, y: 0, width: 1920, height: 1080 },
        aiCardData: {
          sourceCardId: 'c2',
          cardType: 'video',
          title: 't',
          content: {
            mediaType: 'video',
            assetPath: '/abs/projectDir/ai-cards/c2/video.mp4',
            posterPath: '/abs/projectDir/ai-cards/c2/poster.jpg',
            mediaDurationMs: 6000,
            aspectRatio: '16:9',
            prompt: '',
            providerId: 'v',
            model: 'vidu-2',
            generationStatus: 'ready',
          },
          template: 'video-default',
          displayMode: 'fullscreen',
          style: { primaryColor: '#fff', backgroundColor: '#000', fontSize: 48 },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    ];

    const { assets } = prepareTimelineForRemotionRender(timeline);
    const sourcePaths = assets.map((a) => a.sourcePath);
    expect(sourcePaths).toContain('/abs/projectDir/ai-cards/c2/video.mp4');
    expect(sourcePaths).toContain('/abs/projectDir/ai-cards/c2/poster.jpg');
  });
});

describe('resolveRemotionAssetSrc', () => {
  it('uses staticFile for bundled asset keys and direct URLs for local/remote media', () => {
    expect(resolveRemotionAssetSrc('render-assets/audio-0.mp3')).toBe(
      '/static/render-assets/audio-0.mp3',
    );
    expect(resolveRemotionAssetSrc('/tmp/audio.mp3')).toBe('file:///tmp/audio.mp3');
    expect(resolveRemotionAssetSrc('https://example.com/audio.mp3')).toBe(
      'https://example.com/audio.mp3',
    );
  });
});
