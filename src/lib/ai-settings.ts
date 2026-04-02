import type { AISettings } from '../types/ai';

export function getAISettingsIssue(settings: AISettings | null): string | null {
  if (!settings) {
    return '请先完成 AI 配置后再开始分析';
  }

  if (!settings.llmBaseUrl.trim()) {
    return '请先填写 LLM API Base URL';
  }

  if (!settings.llmApiKey.trim()) {
    return '请先填写 LLM API Key';
  }

  if (!settings.llmModel.trim()) {
    return '请先填写模型名称';
  }

  return null;
}
