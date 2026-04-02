import { useEffect, useRef, useState } from 'react';
import type { AssetItem } from '../types';
import { toFileSrc } from '../lib/utils';

interface AssetThumbnailProps {
  asset: AssetItem;
}

function renderAudioPlaceholder() {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #2c9ad1 0%, #1b82c1 55%, #166aa7 100%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '18% 0 auto',
          height: '34%',
          background:
            'repeating-linear-gradient(90deg, rgba(255,255,255,0.85) 0 2px, transparent 2px 6px)',
          opacity: 0.9,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: '52% 0 auto',
          height: '22%',
          background:
            'repeating-linear-gradient(90deg, rgba(0,0,0,0.22) 0 3px, transparent 3px 8px)',
          opacity: 0.55,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 10,
          bottom: 10,
          color: 'rgba(255,255,255,0.86)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
        }}
      >
        AUDIO
      </div>
    </div>
  );
}

function renderSrtPlaceholder() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: '12px 10px',
        boxSizing: 'border-box',
        background: 'linear-gradient(135deg, rgba(22,30,44,0.98) 0%, rgba(11,16,27,0.98) 100%)',
      }}
    >
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          style={{
            height: 7,
            width: index === 2 ? '62%' : index === 1 ? '78%' : '90%',
            borderRadius: 999,
            background: index === 2 ? 'rgba(199,183,255,0.45)' : 'rgba(255,255,255,0.16)',
            marginBottom: index === 2 ? 0 : 8,
          }}
        />
      ))}
      <div
        style={{
          marginTop: 12,
          color: '#c7b7ff',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
        }}
      >
        SRT
      </div>
    </div>
  );
}

function renderGenericPlaceholder(label: string) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        background: 'linear-gradient(135deg, rgba(24,36,58,0.95) 0%, rgba(11,16,27,0.98) 100%)',
        color: '#91a2bc',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.08em',
      }}
    >
      {label}
    </div>
  );
}

export function AssetThumbnail({ asset }: AssetThumbnailProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasError, setHasError] = useState(false);
  const assetSrc = toFileSrc(asset.path);
  const isMediaPreview = asset.type === 'image' || asset.type === 'video';

  useEffect(() => {
    if (asset.type !== 'video') {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    const seekToPreviewFrame = () => {
      try {
        video.currentTime = 0.05;
      } catch {
        video.pause();
      }
    };

    const pauseOnSeeked = () => {
      video.pause();
    };

    video.addEventListener('loadeddata', seekToPreviewFrame);
    video.addEventListener('seeked', pauseOnSeeked);

    if (video.readyState >= 2) {
      seekToPreviewFrame();
    }

    return () => {
      video.removeEventListener('loadeddata', seekToPreviewFrame);
      video.removeEventListener('seeked', pauseOnSeeked);
    };
  }, [asset.type, assetSrc]);

  if (!isMediaPreview || hasError) {
    const label = asset.type === 'audio' ? 'MP3' : asset.type === 'srt' ? 'SRT' : asset.type.toUpperCase();

    if (asset.type === 'audio') {
      return renderAudioPlaceholder();
    }

    if (asset.type === 'srt') {
      return renderSrtPlaceholder();
    }

    return renderGenericPlaceholder(label);
  }

  if (asset.type === 'image') {
    return (
      <img
        src={assetSrc}
        alt={asset.name}
        draggable={false}
        onError={() => setHasError(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />
    );
  }

  return (
    <video
      ref={videoRef}
      src={assetSrc}
      muted
      playsInline
      preload="metadata"
      draggable={false}
      onError={() => setHasError(true)}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
        pointerEvents: 'none',
      }}
    />
  );
}
