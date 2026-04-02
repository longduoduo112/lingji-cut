export type AICardType = 'summary' | 'data' | 'insight' | 'chapter' | 'quote';
export type AICardDisplayMode = 'fullscreen' | 'pip';
export type AICardRenderMode = 'legacy' | 'web-card';

export interface DataContent {
  chartType: 'bar' | 'comparison' | 'ranking' | 'stat';
  items: Array<{
    label: string;
    value: string | number;
    highlight?: boolean;
  }>;
}

export interface CardStyle {
  primaryColor: string;
  backgroundColor: string;
  fontSize: number;
}

export interface WebCardPayload {
  srcDoc: string;
  runtimeStatus?: 'idle' | 'loading' | 'ready' | 'error';
  lastGeneratedAt?: number;
}

export interface AICard {
  id: string;
  type: AICardType;
  title: string;
  content: string | DataContent;
  startMs: number;
  endMs: number;
  displayDurationMs: number;
  displayMode: AICardDisplayMode;
  template: string;
  enabled: boolean;
  style: CardStyle;
  renderMode?: AICardRenderMode;
  cardPrompt?: string;
  webCard?: WebCardPayload;
}

export interface CoverCandidate {
  id: string;
  prompt: string;
  imageUrl: string;
  selected: boolean;
  error?: string;
}

export interface AIAnalysisResult {
  cards: AICard[];
  coverPrompts: string[];
  summary: string;
  keywords: string[];
  globalPrompt?: string;
}

export interface AISettings {
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
  jimengApiUrl: string;
  jimengSessionId: string;
}

export interface AICardOverlayData {
  sourceCardId?: string;
  cardType: AICardType;
  title: string;
  content: string | DataContent;
  template: string;
  displayMode: AICardDisplayMode;
  style: CardStyle;
  renderMode?: AICardRenderMode;
  cardPrompt?: string;
  webCard?: WebCardPayload;
  sourceStartMs?: number;
  sourceEndMs?: number;
}

export const DEFAULT_CARD_STYLE: Record<AICardType, CardStyle> = {
  summary: { primaryColor: '#6366f1', backgroundColor: '#0f172a', fontSize: 48 },
  data: { primaryColor: '#10b981', backgroundColor: '#0f172a', fontSize: 48 },
  insight: { primaryColor: '#f59e0b', backgroundColor: '#0f172a', fontSize: 48 },
  chapter: { primaryColor: '#8b5cf6', backgroundColor: '#0f172a', fontSize: 48 },
  quote: { primaryColor: '#ec4899', backgroundColor: '#0f172a', fontSize: 48 },
};

export const DEFAULT_CARD_DURATION_MS = 5_000;

export function getDefaultTemplate(type: AICardType): string {
  return `${type}-default`;
}

export function getDefaultCardStyle(type: AICardType): CardStyle {
  return { ...DEFAULT_CARD_STYLE[type] };
}

export function isAICardType(value: unknown): value is AICardType {
  return ['summary', 'data', 'insight', 'chapter', 'quote'].includes(String(value));
}

export function isDataContent(value: unknown): value is DataContent {
  if (!value || typeof value !== 'object' || !('chartType' in value) || !('items' in value)) {
    return false;
  }

  return Array.isArray(value.items);
}
