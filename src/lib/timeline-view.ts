const BASE_TIMELINE_PX_PER_SECOND = 96;
const MIN_TIMELINE_TRACK_WIDTH = 960;
const MIN_TIMELINE_ZOOM = 0.02;
const MAX_TIMELINE_ZOOM = 4;
const TIMELINE_ZOOM_STEP = 1.25;

type ZoomDirection = 'in' | 'out';

function roundZoom(value: number): number {
  return Math.round(value * 100) / 100;
}

export function clampTimelineZoom(zoomLevel: number): number {
  return roundZoom(Math.min(MAX_TIMELINE_ZOOM, Math.max(MIN_TIMELINE_ZOOM, zoomLevel)));
}

export function getBaseTimelineWidth(durationMs: number): number {
  return Math.max(
    MIN_TIMELINE_TRACK_WIDTH,
    Math.ceil(Math.max(1_000, durationMs) / 1_000) * BASE_TIMELINE_PX_PER_SECOND,
  );
}

export function getNextTimelineZoom(
  zoomLevel: number,
  direction: ZoomDirection,
): number {
  const nextZoom = direction === 'in' ? zoomLevel * TIMELINE_ZOOM_STEP : zoomLevel / TIMELINE_ZOOM_STEP;
  return clampTimelineZoom(nextZoom);
}

export function getWheelTimelineZoom(zoomLevel: number, deltaY: number): number {
  if (deltaY === 0) {
    return clampTimelineZoom(zoomLevel);
  }

  return getNextTimelineZoom(zoomLevel, deltaY < 0 ? 'in' : 'out');
}

export function getFitTimelineZoom(durationMs: number, viewportWidth: number): number {
  const safeViewportWidth = Math.max(320, viewportWidth);
  return clampTimelineZoom(safeViewportWidth / getBaseTimelineWidth(durationMs));
}

export function getTimelineTrackWidth(
  durationMs: number,
  zoomLevel: number,
  viewportWidth: number,
): number {
  const safeViewportWidth = Math.max(320, viewportWidth);
  const zoomedWidth = Math.round(getBaseTimelineWidth(durationMs) * clampTimelineZoom(zoomLevel));
  return Math.max(safeViewportWidth, zoomedWidth);
}

interface AnchoredTimelineScrollLeftOptions {
  scrollLeft: number;
  pointerX: number;
  previousTrackWidth: number;
  nextTrackWidth: number;
}

export function getAnchoredTimelineScrollLeft({
  scrollLeft,
  pointerX,
  previousTrackWidth,
  nextTrackWidth,
}: AnchoredTimelineScrollLeftOptions): number {
  const safePreviousTrackWidth = Math.max(1, previousTrackWidth);
  const safeNextTrackWidth = Math.max(1, nextTrackWidth);
  const anchorRatio = (scrollLeft + pointerX) / safePreviousTrackWidth;
  return Math.max(0, anchorRatio * safeNextTrackWidth - pointerX);
}
