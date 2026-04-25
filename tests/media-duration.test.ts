import { describe, expect, it, vi } from 'vitest';
import { readAudioDurationMs } from '../electron/media-duration';

describe('readAudioDurationMs', () => {
  it('uses ffprobe instead of video metadata for audio files', async () => {
    const execFile = vi.fn(async () => ({
      stdout: '12.345000\n',
      stderr: '',
    }));

    const durationMs = await readAudioDurationMs('C:/demo/podcast-audio.mp3', {
      binariesDirectory: 'C:/remotion-bin',
      execFile,
    });

    expect(durationMs).toBe(12345);
    expect(execFile).toHaveBeenCalledWith(
      expect.stringContaining('ffprobe'),
      expect.arrayContaining([
        '-show_entries',
        'format=duration',
        'C:/demo/podcast-audio.mp3',
      ]),
    );
  });

  it('rejects invalid ffprobe duration output', async () => {
    await expect(
      readAudioDurationMs('C:/demo/podcast-audio.mp3', {
        binariesDirectory: null,
        execFile: async () => ({ stdout: 'N/A\n', stderr: '' }),
      }),
    ).rejects.toThrow('Unable to read media duration');
  });
});
