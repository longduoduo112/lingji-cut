/**
 * 从抖音作品的 video 对象提取全部视频源候选（设计文档 5.3 / 第 8 节第 4 步）。
 *
 * 收集 play_addr、download_addr 与每个 bit_rate gear 的 play_addr。此处不判断水印、
 * 不去重、不排序——仅尽可能完整地收集候选与其元数据。
 */
import { asNumber, asString, firstUrl, isRecord, pick } from './field';
import type { RawVideoSource, SourceField } from './types';

/**
 * 规范化媒体 URL：抖音 url_list 常见协议相对地址（//host/…）与裸 http；
 * chrome.downloads 需要绝对 https。去除首尾空白。
 */
export function normalizeMediaUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('http://')) return `https://${trimmed.slice('http://'.length)}`;
  return trimmed;
}

/**
 * 从图文/动态作品的 `images[]` 提取可下载资产（设计：动态作品支持）。
 *
 * 每一项要么是「实况/动态图」（自带 `video.play_addr`，本质是短视频，可当 mp4 下载），
 * 要么是静态图（取 `url_list[0]`）。两者都标记 `fromImageSet`，使其作为独立资产展示、
 * 不被清晰度折叠合并。入参是作品级对象（aweme），不是其中的 `video` 子对象。
 */
export function extractImageSources(aweme: unknown): RawVideoSource[] {
  if (!isRecord(aweme)) return [];
  const images = pick(aweme, ['images']);
  if (!Array.isArray(images)) return [];

  const sources: RawVideoSource[] = [];
  for (const image of images) {
    const liveAddr = pick(pick(image, ['video']), ['play_addr', 'playAddr']);
    const live = addrToSource(liveAddr, 'play_addr', { fromImageSet: true });
    if (live) {
      sources.push(live);
      continue;
    }
    const rawUrl = firstUrl(image);
    if (!rawUrl) continue;
    const width = asNumber(pick(image, ['width']));
    const height = asNumber(pick(image, ['height']));
    sources.push({
      url: normalizeMediaUrl(rawUrl),
      sourceField: 'image',
      fromImageSet: true,
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
    });
  }
  return sources;
}

function addrToSource(
  addr: unknown,
  sourceField: SourceField,
  extra: Partial<RawVideoSource> = {},
): RawVideoSource | null {
  const rawUrl = firstUrl(addr);
  if (!rawUrl) return null;
  const url = normalizeMediaUrl(rawUrl);
  const width = asNumber(pick(addr, ['width']));
  const height = asNumber(pick(addr, ['height']));
  const dataSize = asNumber(pick(addr, ['data_size', 'dataSize']));
  return {
    url,
    sourceField,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(dataSize !== undefined ? { dataSize } : {}),
    ...extra,
  };
}

export function extractVideoSources(video: unknown): RawVideoSource[] {
  if (!isRecord(video)) return [];
  const sources: RawVideoSource[] = [];

  const playAddr = addrToSource(pick(video, ['play_addr', 'playAddr']), 'play_addr');
  if (playAddr) sources.push(playAddr);

  const downloadAddr = addrToSource(pick(video, ['download_addr', 'downloadAddr']), 'download_addr');
  if (downloadAddr) sources.push(downloadAddr);

  const bitRates = pick(video, ['bit_rate', 'bitRate']);
  if (Array.isArray(bitRates)) {
    for (const gear of bitRates) {
      const gearAddr = pick(gear, ['play_addr', 'playAddr']);
      const isBytevc1Raw = asNumber(pick(gear, ['is_bytevc1', 'isBytevc1']));
      const source = addrToSource(gearAddr, 'bit_rate', {
        bitrate: asNumber(pick(gear, ['bit_rate', 'bitRate'])),
        format: asString(pick(gear, ['format'])),
        gearName: asString(pick(gear, ['gear_name', 'gearName'])),
        ...(isBytevc1Raw !== undefined ? { isBytevc1: isBytevc1Raw === 1 } : {}),
      });
      if (source) sources.push(source);
    }
  }

  return sources;
}
