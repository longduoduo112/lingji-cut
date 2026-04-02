import { describe, expect, it } from 'vitest';
import {
  clampTimelineZoom,
  getAnchoredTimelineScrollLeft,
  getFitTimelineZoom,
  getNextTimelineZoom,
  getTimelineTrackWidth,
  getWheelTimelineZoom,
} from '../src/lib/timeline-view';

describe('clampTimelineZoom', () => {
  it('keeps zoom inside supported bounds', () => {
    expect(clampTimelineZoom(0.001)).toBe(0.02);
    expect(clampTimelineZoom(1)).toBe(1);
    expect(clampTimelineZoom(10)).toBe(4);
  });
});

describe('getNextTimelineZoom', () => {
  it('zooms in and out with multiplicative steps', () => {
    expect(getNextTimelineZoom(1, 'in')).toBe(1.25);
    expect(getNextTimelineZoom(1, 'out')).toBe(0.8);
  });
});

describe('getWheelTimelineZoom', () => {
  it('zooms in when scrolling up and zooms out when scrolling down', () => {
    expect(getWheelTimelineZoom(1, -24)).toBe(1.25);
    expect(getWheelTimelineZoom(1, 24)).toBe(0.8);
  });

  it('clamps wheel zoom changes to the supported bounds', () => {
    expect(getWheelTimelineZoom(4, -24)).toBe(4);
    expect(getWheelTimelineZoom(0.02, 24)).toBe(0.02);
  });
});

describe('getFitTimelineZoom', () => {
  it('shrinks long timelines enough to fit the current viewport', () => {
    expect(getFitTimelineZoom(600_000, 1280)).toBe(0.02);
  });

  it('does not upscale short timelines beyond the maximum zoom', () => {
    expect(getFitTimelineZoom(10_000, 2400)).toBe(2.5);
  });
});

describe('getTimelineTrackWidth', () => {
  it('never renders narrower than the visible viewport', () => {
    expect(getTimelineTrackWidth(30_000, 0.1, 1100)).toBe(1100);
  });

  it('expands when the user zooms in', () => {
    expect(getTimelineTrackWidth(30_000, 2, 1100)).toBeGreaterThan(1100);
  });
});

describe('getAnchoredTimelineScrollLeft', () => {
  it('keeps the pointer anchored to the same timeline position after zooming', () => {
    expect(
      getAnchoredTimelineScrollLeft({
        scrollLeft: 300,
        pointerX: 250,
        previousTrackWidth: 2_000,
        nextTrackWidth: 2_500,
      }),
    ).toBe(437.5);
  });
});
