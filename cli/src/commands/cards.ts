// cli/src/commands/cards.ts
import type { ToolCaller } from '../client';
import { runGenerationCommand } from './generation';
import { CliError } from '../errors';
// 本应用中卡片随字幕分析一并产出，cards gen 等价于 subtitle analyze。
export async function runCardsCommand(action: string | undefined, flags: Record<string, string | boolean>, client: ToolCaller): Promise<unknown> {
  if (action !== 'gen') throw new CliError(`未知 cards 子命令: ${action ?? '(空)'}（支持 gen）`, 'bad_args', 2);
  return runGenerationCommand({ toolName: 'lingji_analyze_subtitles', flags, client });
}
