import type {
  AICard,
  AISegmentAnalysis,
  AIStoryboardPlan,
  AIVisualSuggestion,
  AIVisualSuggestionType,
  CardStyle,
} from '../types/ai';

/**
 * 自动从视觉编排建议生成动画卡片时使用的默认视觉样式。
 * 与 MotionPanel 手动生成区保持一致的紫色基调。
 */
export const STORYBOARD_MOTION_CARD_STYLE: CardStyle = {
  primaryColor: '#c084fc',
  backgroundColor: '#05060c',
  fontSize: 46,
};

/** 视觉编排自动生成的动画卡片 ID 前缀。 */
export const STORYBOARD_MOTION_CARD_ID_PREFIX = 'storyboard-motion-';

/** 判断某张 motion card 是否来自视觉编排自动生成流程。 */
export function isStoryboardMotionCardId(cardId: string): boolean {
  return cardId.startsWith(STORYBOARD_MOTION_CARD_ID_PREFIX);
}

/** 建议 → 动画卡片 ID。 */
export function buildStoryboardMotionCardId(suggestion: AIVisualSuggestion): string {
  return `${STORYBOARD_MOTION_CARD_ID_PREFIX}${suggestion.id}`;
}

/**
 * 判断某条建议是否应该参与视觉编排自动生成动画流程。
 * `content-card` 类型归内容卡片 tab 处理，这里不重复生成。
 */
export function isSuggestionEligibleForMotion(suggestion: AIVisualSuggestion): boolean {
  return suggestion.suggestionType !== 'content-card';
}

/** 过滤出可用于自动生成动画的建议，保持原顺序。 */
export function selectMotionEligibleSuggestions(
  plan: AIStoryboardPlan | null,
): AIVisualSuggestion[] {
  if (!plan) {
    return [];
  }
  return plan.suggestions.filter(isSuggestionEligibleForMotion);
}

function labelForSuggestion(type: AIVisualSuggestionType): string {
  switch (type) {
    case 'data-motion':
      return '数据动画';
    case 'explainer-motion':
      return '解释动画';
    case 'chapter-transition':
      return '章节切场';
    default:
      return '内容卡片';
  }
}

function extractTitleFromBrief(brief: string, fallback: string): string {
  if (!brief) {
    return fallback;
  }
  const [head] = brief.split('：');
  const trimmed = (head ?? '').trim();
  return trimmed || fallback;
}

/**
 * 根据建议类型返回动画生成时长（秒）。
 * 与卡片展示时长（displayDurationMs）解耦——后者控制卡片在时间线上覆盖的范围，
 * 这里只控制 Remotion 动画代码本身的节奏长度，应当短而精准。
 */
function resolveAnimationDurationSeconds(suggestion: AIVisualSuggestion): number {
  switch (suggestion.suggestionType) {
    case 'chapter-transition':
      // 切场仅需瞬间重置节奏，快进快出
      return 3;
    case 'data-motion':
      // 数据揭示：快速完成数字/图表的核心动效
      return 5;
    case 'explainer-motion':
      // 分步解释：2~3 个步骤，每步约 1.5~2 秒
      return 6;
    default:
      return 4;
  }
}

function describeDetail(
  suggestion: AIVisualSuggestion,
  segment: AISegmentAnalysis | undefined,
): string {
  const keywords = segment?.keywords?.filter(Boolean) ?? [];
  const entities = segment?.entities?.filter(Boolean) ?? [];
  const durationSec = resolveAnimationDurationSeconds(suggestion);

  switch (suggestion.suggestionType) {
    case 'data-motion': {
      const bits: string[] = [`以 ${suggestion.templateKey} 模板呈现数据。`];
      if (entities.length > 0) {
        bits.push(`重点展示：${entities.join('、')}。`);
      }
      if (keywords.length > 0) {
        bits.push(`关键词：${keywords.join('、')}。`);
      }
      bits.push(`必须在 ${durationSec} 秒内完整揭示核心数字，节奏紧凑利落，强化关键数据与对比关系，不做多余过渡。`);
      return bits.join(' ');
    }
    case 'explainer-motion': {
      const bits: string[] = [`以 ${suggestion.templateKey} 模板分步呈现，最多展示 2~3 个步骤，每步停留 1.5~2 秒。`];
      if (keywords.length > 0) {
        bits.push(`围绕关键词：${keywords.join('、')}。`);
      }
      bits.push(`全程 ${durationSec} 秒内完成，节奏平稳，逻辑清晰，避免过度装饰。`);
      return bits.join(' ');
    }
    case 'chapter-transition':
      return `章节切场，使用 ${suggestion.templateKey} 模板。全程不超过 ${durationSec} 秒，快进快出，仅做节奏重置，视觉简洁克制，不喧宾夺主。`;
    default:
      return `采用 ${suggestion.templateKey} 模板稳定呈现内容重点，时长控制在 ${durationSec} 秒以内。`;
  }
}

/**
 * 根据一条视觉建议构造动画生成所需的完整 prompt。
 */
export function buildMotionPromptFromSuggestion(
  suggestion: AIVisualSuggestion,
  segment?: AISegmentAnalysis,
): string {
  const mode = suggestion.displayMode === 'fullscreen' ? '16:9 全屏' : '16:9 画中画（PiP）';
  const durationSeconds = resolveAnimationDurationSeconds(suggestion);
  const brief = suggestion.visualBrief?.trim() || labelForSuggestion(suggestion.suggestionType);
  const detail = describeDetail(suggestion, segment);
  const reason = suggestion.reason?.trim();

  const lines: string[] = [];
  lines.push(
    `生成一个 ${mode} Remotion 动画，时长 ${durationSeconds} 秒。这是一段短小精准的视觉插播，用于强化"${brief}"这一内容要点，不需要涵盖整段音频，只需突出核心瞬间。`,
  );
  lines.push(detail);
  if (reason) {
    lines.push(`编排依据：${reason}`);
  }
  return lines.join('\n\n');
}

export interface StoryboardMotionCardDraft {
  suggestion: AIVisualSuggestion;
  segment: AISegmentAnalysis | undefined;
  card: AICard;
  prompt: string;
}

/**
 * 将视觉编排计划转换为一批待生成动画卡片的草稿。
 * 产出的 AICard 已经包含稳定的 ID、时间段、模式等信息，
 * 但 motionCard 中的 sourceCode/compiledCode 仍为空，待调用 service 填充。
 */
export function buildStoryboardMotionCardDrafts(
  plan: AIStoryboardPlan | null,
  options: { style?: CardStyle } = {},
): StoryboardMotionCardDraft[] {
  if (!plan) {
    return [];
  }

  const style = options.style ?? STORYBOARD_MOTION_CARD_STYLE;
  const segmentMap = new Map(plan.segments.map((segment) => [segment.id, segment]));

  return selectMotionEligibleSuggestions(plan).map((suggestion) => {
    const segment = segmentMap.get(suggestion.segmentId);
    const prompt = buildMotionPromptFromSuggestion(suggestion, segment);
    const fallbackTitle = labelForSuggestion(suggestion.suggestionType);
    const title = extractTitleFromBrief(suggestion.visualBrief, fallbackTitle);
    const cardId = buildStoryboardMotionCardId(suggestion);

    const card: AICard = {
      id: cardId,
      segmentId: suggestion.segmentId,
      type: 'motion',
      title,
      content: suggestion.visualBrief || fallbackTitle,
      cardPrompt: prompt,
      startMs: suggestion.startMs,
      endMs: suggestion.endMs,
      displayDurationMs: suggestion.displayDurationMs,
      displayMode: suggestion.displayMode,
      template: `motion-${suggestion.templateKey}`,
      enabled: true,
      style: { ...style },
      renderMode: 'motion-card',
      motionCard: {
        prompt,
        sourceCode: '',
        compiledCode: '',
        compiledAt: 0,
        retryCount: 0,
      },
    };

    return { suggestion, segment, card, prompt };
  });
}
