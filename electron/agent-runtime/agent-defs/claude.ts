import type { RuntimeAgentDef } from '../types';

export const claudeAgentDef = {
  id: 'claude',
  name: 'Claude Code',
  bin: 'claude',
  versionArgs: ['--version'],
  streamFormat: 'claude-stream-json',
  promptViaStdin: true,
  // TODO: Confirm the exact Claude CLI resume flag against the real binary.
  //       Implemented here as `--resume <sessionId>` so multi-turn sessions
  //       persist their externalId; literal flag pending manual verification.
  buildArgs: (ctx) => [
    '--print',
    '--output-format',
    'stream-json',
    '--verbose',
    ...(ctx.model ? ['--model', ctx.model] : []),
    ...(ctx.cwd ? ['--add-dir', ctx.cwd] : []),
    ...(ctx.resumeSessionId ? ['--resume', ctx.resumeSessionId] : []),
  ],
} satisfies RuntimeAgentDef;
