import { describe, expect, it } from 'vitest';
import { downmixChannels, encodePcm16Wav } from '@/offscreen/audio-codec';

describe('offscreen audio codec', () => {
  it('downmixes multiple channels by averaging samples', () => {
    const mono = downmixChannels([
      new Float32Array([1, 0, -1]),
      new Float32Array([-1, 0.5, 1]),
    ]);
    expect(Array.from(mono)).toEqual([0, 0.25, 0]);
  });

  it('encodes mono samples as a valid 16-bit PCM WAV', () => {
    const wav = encodePcm16Wav(new Float32Array([-1, 0, 1]), 16_000);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    const ascii = (offset: number, length: number) =>
      String.fromCharCode(...wav.slice(offset, offset + length));

    expect(ascii(0, 4)).toBe('RIFF');
    expect(ascii(8, 4)).toBe('WAVE');
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getInt16(44, true)).toBe(-32768);
    expect(view.getInt16(46, true)).toBe(0);
    expect(view.getInt16(48, true)).toBe(32767);
  });
});
