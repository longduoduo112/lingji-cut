import { Composition } from 'remotion';
import type { ExportRenderConfig } from '../lib/export-settings';
import { createDefaultTimeline } from '../types';
import { PodcastComposition } from './PodcastComposition';

export function RemotionRoot() {
  return (
    <Composition
      id="PodcastComposition"
      component={PodcastComposition}
      durationInFrames={300}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        timeline: createDefaultTimeline(),
        srtEntries: [],
        renderConfig: null,
      }}
      calculateMetadata={({ props }) => {
        const timeline = props.timeline ?? createDefaultTimeline();
        const renderConfig = (props.renderConfig as ExportRenderConfig | null | undefined) ?? null;
        return {
          width: renderConfig?.renderWidth ?? timeline.width,
          height: renderConfig?.renderHeight ?? timeline.height,
          fps: timeline.fps,
          durationInFrames: Math.max(
            1,
            Math.round((timeline.podcast.durationMs / 1000) * timeline.fps),
          ),
        };
      }}
    />
  );
}
