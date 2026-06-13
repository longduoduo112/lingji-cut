import type { RuntimeAgentDef } from '../types';

// TODO: Verify actual Codex CLI flags for JSON event output mode against real binary
// TODO: Verify Codex resume flag/shape against real binary. `codex exec` takes the
//       prompt as a trailing positional arg; resume is not wired here yet (codex
//       resume CLI form unconfirmed). Multi-turn memory for codex remains a follow-up.
export const codexAgentDef = {
  id: 'codex',
  name: 'Codex',
  bin: 'codex',
  versionArgs: ['--version'],
  streamFormat: 'codex-json-event',
  // `codex exec --json [--model <m>] <prompt>` — prompt is a trailing positional arg.
  // codex is NOT promptViaStdin, so the prompt must live in argv or the child gets no input.
  buildArgs: (ctx) => [
    'exec',
    '--json',
    ...(ctx.model ? ['--model', ctx.model] : []),
    ctx.prompt,
  ],
} satisfies RuntimeAgentDef;
