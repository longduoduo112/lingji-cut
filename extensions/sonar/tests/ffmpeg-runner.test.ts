import { describe, expect, it, vi } from 'vitest';
import { buildWav16kMonoArgs, createFfmpegRunner, type FfmpegCore, type FfmpegLogEntry } from '@/offscreen/ffmpeg-runner';

function createFakeCore(output: Uint8Array): FfmpegCore & { calls: string[]; files: Map<string, Uint8Array> } {
  const calls: string[] = [];
  const files = new Map<string, Uint8Array>();
  let logger: ((entry: FfmpegLogEntry) => void) | undefined;
  return {
    calls,
    files,
    ret: 0,
    FS: {
      writeFile(path, data) { calls.push(`write:${path}`); files.set(path, data); },
      readFile(path) { calls.push(`read:${path}`); return files.get(path) ?? output; },
      unlink(path) { calls.push(`unlink:${path}`); files.delete(path); },
    },
    exec(...args: string[]) { calls.push(`exec:${args.join(' ')}`); files.set('output.wav', output); },
    reset() { calls.push('reset'); },
    setLogger(cb) { logger = cb; },
    emit(message: string) { logger?.({ type: 'fferr', message }); },
  } as FfmpegCore & { calls: string[]; files: Map<string, Uint8Array>; emit(m: string): void };
}

describe('buildWav16kMonoArgs', () => {
  it('builds a 16kHz mono WAV transcode argv with -nostdin -y', () => {
    expect(buildWav16kMonoArgs('input.mp4', 'output.wav')).toEqual([
      '-nostdin', '-y', '-i', 'input.mp4', '-vn', '-ac', '1', '-ar', '16000', '-f', 'wav', 'output.wav',
    ]);
  });
});

describe('createFfmpegRunner', () => {
  it('writes input, execs the transcode, reads output, then resets and cleans temp files', async () => {
    const wav = new Uint8Array([1, 2, 3]);
    const core = createFakeCore(wav);
    const runner = createFfmpegRunner({ loadCore: async () => core });

    const result = await runner.transcodeToWav16kMono(new Uint8Array([9]));

    expect(result).toEqual(wav);
    expect(core.calls).toEqual([
      'write:input.mp4',
      'exec:-nostdin -y -i input.mp4 -vn -ac 1 -ar 16000 -f wav output.wav',
      'read:output.wav',
      'reset',
      'unlink:input.mp4',
      'unlink:output.wav',
    ]);
  });

  it('loads the core only once across calls', async () => {
    const core = createFakeCore(new Uint8Array([1]));
    const loadCore = vi.fn(async () => core);
    const runner = createFfmpegRunner({ loadCore });

    await runner.transcodeToWav16kMono(new Uint8Array([1]));
    await runner.transcodeToWav16kMono(new Uint8Array([2]));

    expect(loadCore).toHaveBeenCalledOnce();
  });

  it('cleans temp files even when exec throws', async () => {
    const core = createFakeCore(new Uint8Array());
    core.exec = () => { throw new Error('ffmpeg boom'); };
    const unlinked: string[] = [];
    core.FS.unlink = (path: string) => { unlinked.push(path); };
    const runner = createFfmpegRunner({ loadCore: async () => core });

    await expect(runner.transcodeToWav16kMono(new Uint8Array([1]))).rejects.toThrow('ffmpeg boom');
    expect(unlinked).toEqual(['input.mp4', 'output.wav']);
  });

  it('throws when exec leaves a non-zero exit code', async () => {
    const core = createFakeCore(new Uint8Array());
    core.exec = () => { core.ret = 1; };
    const runner = createFfmpegRunner({ loadCore: async () => core });

    await expect(runner.transcodeToWav16kMono(new Uint8Array([1]))).rejects.toThrow(/ffmpeg/i);
  });

  it('includes the ffmpeg log reason in the exit-code error', async () => {
    const core = createFakeCore(new Uint8Array()) as ReturnType<typeof createFakeCore> & { emit(m: string): void };
    core.exec = () => {
      core.emit('  Duration: N/A, bitrate: N/A');
      core.emit('input.mp4: Invalid data found when processing input');
      core.ret = 1;
    };
    const runner = createFfmpegRunner({ loadCore: async () => core });

    await expect(runner.transcodeToWav16kMono(new Uint8Array([1])))
      .rejects.toThrow('Invalid data found when processing input');
  });

  it('surfaces a timeout error instead of hanging when core load never settles', async () => {
    const runner = createFfmpegRunner({ loadCore: () => new Promise<FfmpegCore>(() => {}), loadTimeoutMs: 10 });

    await expect(runner.transcodeToWav16kMono(new Uint8Array([1]))).rejects.toThrow(/超时/);
  });
});
