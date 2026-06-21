import { downmixChannels, encodePcm16Wav } from './audio-codec';
import {
  isOffscreenExtractAudioRequest,
  isOffscreenPrepareDownloadRequest,
  isOffscreenReleaseDownloadRequest,
  isOffscreenStartDownloadRequest,
  type OffscreenExtractAudioResponse,
  type OffscreenPrepareDownloadResponse,
} from './protocol';
import { fetchDownloadBlob } from './download-blob';

const TARGET_SAMPLE_RATE = 16_000;
const DOWNLOAD_BLOB_TTL_MS = 10 * 60 * 1000;
const downloadBlobs = new Map<string, { blobUrl: string; timer: ReturnType<typeof setTimeout> }>();

function releaseDownloadBlob(token: string): void {
  const prepared = downloadBlobs.get(token);
  if (!prepared) return;
  clearTimeout(prepared.timer);
  URL.revokeObjectURL(prepared.blobUrl);
  downloadBlobs.delete(token);
}

function startDownloadBlob(token: string, filename: string): void {
  const prepared = downloadBlobs.get(token);
  if (!prepared) throw new Error('待下载的视频文件已失效，请重试');
  const anchor = document.createElement('a');
  anchor.href = prepared.blobUrl;
  anchor.download = filename.split('/').at(-1) || 'douyin-video.mp4';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

async function prepareDownloadBlob(url: string): Promise<{ blobUrl: string; token: string }> {
  const blobUrl = URL.createObjectURL(await fetchDownloadBlob(url));
  const token = crypto.randomUUID();
  const timer = setTimeout(() => releaseDownloadBlob(token), DOWNLOAD_BLOB_TTL_MS);
  downloadBlobs.set(token, { blobUrl, timer });
  return { blobUrl, token };
}

async function readOpfsFile(name: string): Promise<File> {
  const root = await navigator.storage.getDirectory();
  return (await root.getFileHandle(name)).getFile();
}

async function writeOpfsFile(name: string, bytes: Uint8Array<ArrayBuffer>): Promise<void> {
  const root = await navigator.storage.getDirectory();
  const handle = await root.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(new Blob([bytes.buffer]));
  await writable.close();
}

function createMonoBuffer(context: AudioContext, decoded: AudioBuffer): AudioBuffer {
  const channels = Array.from(
    { length: decoded.numberOfChannels },
    (_, index) => decoded.getChannelData(index),
  );
  const mono = downmixChannels(channels);
  const buffer = context.createBuffer(1, mono.length, decoded.sampleRate);
  buffer.copyToChannel(mono, 0);
  return buffer;
}

async function resample(buffer: AudioBuffer): Promise<Float32Array> {
  const length = Math.max(1, Math.ceil(buffer.duration * TARGET_SAMPLE_RATE));
  const offline = new OfflineAudioContext(1, length, TARGET_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return new Float32Array(rendered.getChannelData(0));
}

async function extractAudio(inputName: string, outputName: string): Promise<void> {
  const input = await readOpfsFile(inputName);
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await input.arrayBuffer());
    const samples = await resample(createMonoBuffer(context, decoded));
    await writeOpfsFile(outputName, encodePcm16Wav(samples, TARGET_SAMPLE_RATE));
  } finally {
    await context.close();
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (isOffscreenExtractAudioRequest(message)) {
    void extractAudio(message.inputName, message.outputName)
      .then(() => sendResponse({ ok: true } satisfies OffscreenExtractAudioResponse))
      .catch((error) => sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      } satisfies OffscreenExtractAudioResponse));
    return true;
  }
  if (isOffscreenPrepareDownloadRequest(message)) {
    void prepareDownloadBlob(message.url)
      .then((prepared) => sendResponse({ ok: true, ...prepared } satisfies OffscreenPrepareDownloadResponse))
      .catch((error) => sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      } satisfies OffscreenPrepareDownloadResponse));
    return true;
  }
  if (isOffscreenReleaseDownloadRequest(message)) {
    releaseDownloadBlob(message.token);
    sendResponse({ ok: true });
    return false;
  }
  if (isOffscreenStartDownloadRequest(message)) {
    try {
      startDownloadBlob(message.token, message.filename);
      sendResponse({ ok: true });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return false;
});
