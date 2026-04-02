import { v4 as uuid } from 'uuid';
import type { AISettings, CoverCandidate } from '../types/ai';

interface JimengApiResponse {
  data?: Array<{ url?: string | null } | null> | null;
}

export interface JimengImageRequest {
  url: string;
  headers: Record<string, string>;
  body: {
    model: string;
    prompt: string;
    ratio: string;
    resolution: string;
  };
}

export function buildJimengImageRequest(
  prompt: string,
  settings: AISettings,
): JimengImageRequest {
  return {
    url: `${settings.jimengApiUrl.replace(/\/+$/, '')}/v1/images/generations`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.jimengSessionId}`,
    },
    body: {
      model: 'jimeng-4.5',
      prompt,
      ratio: '16:9',
      resolution: '2k',
    },
  };
}

export function extractJimengImageUrl(payload: JimengApiResponse): string | null {
  const imageUrl = payload.data?.[0]?.url;
  return typeof imageUrl === 'string' && imageUrl ? imageUrl : null;
}

export async function generateImage(prompt: string, settings: AISettings): Promise<string> {
  const request = buildJimengImageRequest(prompt, settings);
  const response = await fetch(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(request.body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`即梦 API 错误 ${response.status}: ${errorText}`);
  }

  const imageUrl = extractJimengImageUrl((await response.json()) as JimengApiResponse);
  if (!imageUrl) {
    throw new Error('即梦 API 未返回图片 URL');
  }

  return imageUrl;
}

export async function downloadImage(imageUrl: string, outputPath: string): Promise<void> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`下载图片失败: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, buffer);
}

export async function generateCoverCandidates(
  prompts: string[],
  settings: AISettings,
  coversDir: string,
): Promise<CoverCandidate[]> {
  const path = await import('node:path');
  const candidates: CoverCandidate[] = [];

  for (const [index, prompt] of prompts.entries()) {
    const id = uuid();
    const outputPath = path.join(coversDir, `cover-${id}.png`);

    try {
      const imageUrl = await generateImage(prompt, settings);
      await downloadImage(imageUrl, outputPath);
      candidates.push({
        id,
        prompt,
        imageUrl: outputPath,
        selected: index === 0,
      });
    } catch (error) {
      candidates.push({
        id,
        prompt,
        imageUrl: '',
        selected: false,
        error: error instanceof Error ? error.message : '封面生成失败',
      });
    }
  }

  return candidates;
}
