import { getImageProvider } from '../src/lib/image-gen/registry';
import { resolvePromptBinding } from '../src/lib/llm/binding-resolver';
import {
  ensureCardAssetDir,
  writeCardImage,
  writeCardMeta,
} from './ai-card-assets';
import type {
  AISettings,
  MediaCardContent,
  PromptBindingMap,
  ImageAspectRatio,
} from '../src/types/ai';
import type {
  ImageGenerationContext,
  ImageGenerationProgressUpdate,
} from '../src/lib/image-gen/types';

export interface GenerateCardImageArgs {
  projectDir: string;
  cardId: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio: ImageAspectRatio;
  providerId?: string | null;
  model?: string | null;
  extraParams?: Record<string, unknown>;
}

export interface CardMediaHandlerCtx {
  settings: AISettings;
  projectBindings: PromptBindingMap | null;
  onProgress: (u: ImageGenerationProgressUpdate) => void;
  signal?: AbortSignal;
}

export async function handleGenerateCardImage(
  args: GenerateCardImageArgs,
  ctx: CardMediaHandlerCtx,
): Promise<MediaCardContent> {
  // 优先使用调用方显式指定的 providerId / model；否则走 card.image binding 回退
  let providerId = args.providerId ?? null;
  let model = args.model ?? null;

  if (!providerId || !model) {
    try {
      const binding = resolvePromptBinding('card.image', ctx.settings, ctx.projectBindings);
      if (!providerId) providerId = binding.imageProvider?.id ?? null;
      if (!model) model = binding.imageModel ?? null;
    } catch (err) {
      // resolvePromptBinding 在缺 LLM provider 时也会抛——card.image 实际只关心 image binding，
      // 因此只把 image binding missing 作为致命错误向上抛。
      throw err;
    }
  }

  const provider = providerId
    ? ctx.settings.imageProviders.find((p) => p.id === providerId) ?? null
    : null;
  if (!provider) {
    throw new Error('card.image 未绑定 ImageProvider');
  }
  if (!model) {
    throw new Error('card.image 未指定模型');
  }

  await ensureCardAssetDir(args.projectDir, args.cardId);

  const adapter = getImageProvider(provider.type);
  const signal = ctx.signal ?? new AbortController().signal;
  const igCtx: ImageGenerationContext = {
    taskId: `card-image-${args.cardId}`,
    signal,
    onProgress: ctx.onProgress,
  };
  const result = await adapter.generate(
    {
      prompt: args.prompt,
      model,
      aspectRatio: args.aspectRatio,
      n: 1,
      extraParams: args.extraParams,
    },
    { baseUrl: provider.baseUrl, apiKey: provider.apiKey, extras: provider.extras },
    igCtx,
  );

  const img = result.images[0];
  if (!img) throw new Error('image provider 未返回图片');
  const buf = await imageToBuffer(img);
  ctx.onProgress({ percent: 95, phase: 'downloading', message: '保存图片…' });
  const assetPath = await writeCardImage(args.projectDir, args.cardId, buf);
  const generatedAt = Date.now();
  await writeCardMeta(args.projectDir, args.cardId, {
    cardId: args.cardId,
    mediaType: 'image',
    prompt: args.prompt,
    negativePrompt: args.negativePrompt,
    providerId: provider.id,
    model,
    aspectRatio: args.aspectRatio,
    generatedAt,
    extras: args.extraParams,
  });
  ctx.onProgress({ percent: 100, phase: 'rendering', message: '完成' });

  return {
    mediaType: 'image',
    assetPath,
    aspectRatio: args.aspectRatio,
    prompt: args.prompt,
    negativePrompt: args.negativePrompt,
    providerId: provider.id,
    model,
    generationStatus: 'ready',
    generatedAt,
    extraParams: args.extraParams,
  };
}

async function imageToBuffer(img: {
  url?: string;
  base64?: string;
  mimeType?: string;
}): Promise<Buffer> {
  if (img.base64) return Buffer.from(img.base64, 'base64');
  if (img.url) {
    const res = await fetch(img.url);
    if (!res.ok) throw new Error(`下载图片失败 HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error('image 既没有 base64 也没有 url');
}
