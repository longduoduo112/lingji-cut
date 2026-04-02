import { Img, OffthreadVideo, Sequence } from 'remotion';
import type { OverlayItem } from '../types';
import { resolveRemotionAssetSrc } from '../lib/remotion-assets';
import { msToFrame } from '../lib/utils';

interface MediaOverlayProps {
  overlay: OverlayItem;
  fps: number;
}

export function MediaOverlay({ overlay, fps }: MediaOverlayProps) {
  const from = msToFrame(overlay.startMs, fps);
  const durationInFrames = Math.max(1, msToFrame(overlay.durationMs, fps));
  const style = {
    position: 'absolute' as const,
    left: overlay.position.x,
    top: overlay.position.y,
    width: overlay.position.width,
    height: overlay.position.height,
    objectFit: 'cover' as const,
  };

  return (
    <Sequence from={from} durationInFrames={durationInFrames}>
      {overlay.type === 'video' ? (
        <OffthreadVideo src={resolveRemotionAssetSrc(overlay.assetPath)} style={style} />
      ) : (
        <Img src={resolveRemotionAssetSrc(overlay.assetPath)} style={style} />
      )}
    </Sequence>
  );
}
