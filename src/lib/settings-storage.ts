// src/lib/settings-storage.ts

// ── Keys ──
const CUSTOM_TEMPLATES_KEY = 'podcast-editor-custom-templates';
const REVIEW_CRITERIA_KEY = 'podcast-editor-review-criteria';
const TTS_SETTINGS_KEY = 'podcast-editor-tts-settings';

// ── Custom Templates ──
export interface CustomScriptTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  createdAt: string;
  updatedAt: string;
}

export function loadCustomTemplates(): CustomScriptTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    return raw ? (JSON.parse(raw) as CustomScriptTemplate[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomTemplates(templates: CustomScriptTemplate[]): void {
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(templates));
}

export function addCustomTemplate(
  template: Omit<CustomScriptTemplate, 'id' | 'createdAt' | 'updatedAt'>,
): CustomScriptTemplate {
  const templates = loadCustomTemplates();
  const now = new Date().toISOString();
  const newTemplate: CustomScriptTemplate = {
    ...template,
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  };
  templates.push(newTemplate);
  saveCustomTemplates(templates);
  return newTemplate;
}

export function updateCustomTemplate(
  id: string,
  updates: Partial<Omit<CustomScriptTemplate, 'id' | 'createdAt'>>,
): void {
  const templates = loadCustomTemplates();
  const index = templates.findIndex((t) => t.id === id);
  if (index === -1) return;
  templates[index] = { ...templates[index], ...updates, updatedAt: new Date().toISOString() };
  saveCustomTemplates(templates);
}

export function deleteCustomTemplate(id: string): void {
  const templates = loadCustomTemplates().filter((t) => t.id !== id);
  saveCustomTemplates(templates);
}

// ── Review Criteria ──
const DEFAULT_REVIEW_CRITERIA = `请重点关注：
1. 数据引用是否标注来源
2. 是否有过于书面化的表达
3. 段落过渡是否自然
4. 口播节奏是否合理`;

export function loadReviewCriteria(): string {
  return localStorage.getItem(REVIEW_CRITERIA_KEY) ?? DEFAULT_REVIEW_CRITERIA;
}

export function saveReviewCriteria(criteria: string): void {
  localStorage.setItem(REVIEW_CRITERIA_KEY, criteria);
}

// ── TTS Settings ──
export interface TTSSettings {
  apiKey: string;
  voiceId: string;
  speed: number;
}

const DEFAULT_TTS_SETTINGS: TTSSettings = {
  apiKey: '',
  voiceId: 'male-qn-qingse',
  speed: 1.0,
};

export function loadTTSSettings(): TTSSettings {
  try {
    const raw = localStorage.getItem(TTS_SETTINGS_KEY);
    return raw ? { ...DEFAULT_TTS_SETTINGS, ...(JSON.parse(raw) as Partial<TTSSettings>) } : DEFAULT_TTS_SETTINGS;
  } catch {
    return DEFAULT_TTS_SETTINGS;
  }
}

export function saveTTSSettings(settings: TTSSettings): void {
  localStorage.setItem(TTS_SETTINGS_KEY, JSON.stringify(settings));
}
