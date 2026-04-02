import { describe, expect, it } from 'vitest';
import { formatTime, frameToMs, msToFrame } from '../src/lib/utils';

describe('msToFrame', () => {
  it('converts milliseconds to frames using floor semantics', () => {
    expect(msToFrame(1000, 30)).toBe(30);
    expect(msToFrame(500, 30)).toBe(15);
    expect(msToFrame(33, 30)).toBe(0);
    expect(msToFrame(34, 30)).toBe(1);
  });
});

describe('frameToMs', () => {
  it('converts frames back to milliseconds', () => {
    expect(frameToMs(30, 30)).toBe(1000);
    expect(frameToMs(15, 30)).toBe(500);
  });
});

describe('formatTime', () => {
  it('formats milliseconds as mm:ss', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(62000)).toBe('01:02');
  });
});
