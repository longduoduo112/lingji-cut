import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mockState = {
  agentOperation: {
    isOperating: true,
    operationType: 'generate',
    progress: 0,
    canInterrupt: true,
    backgrounded: false,
  },
  activeStream: {
    streamId: 'stream-generate-1',
    filePath: 'script.md',
    kind: 'generate',
    phase: 'streaming',
  },
};

vi.mock('../src/store/script', () => ({
  useScriptStore: () => mockState,
}));

import { AgentProgressBar } from '../src/components/agent/AgentProgressBar';

describe('AgentProgressBar', () => {
  beforeEach(() => {
    mockState.agentOperation = {
      isOperating: true,
      operationType: 'generate',
      progress: 0,
      canInterrupt: true,
      backgrounded: false,
    };
    mockState.activeStream = {
      streamId: 'stream-generate-1',
      filePath: 'script.md',
      kind: 'generate',
      phase: 'streaming',
    };
  });

  it('shows indeterminate writing state during MCP live generation', () => {
    const html = renderToStaticMarkup(<AgentProgressBar />);

    expect(html).toContain('AI 正在写稿');
    expect(html).toContain('正在逐段写入编辑器');
    expect(html).not.toContain('0%');
  });

  it('shows local update playback without forcing global loading copy', () => {
    mockState.agentOperation = {
      isOperating: false,
      operationType: null as never,
      progress: 0,
      canInterrupt: false,
      backgrounded: false,
    };
    mockState.activeStream = {
      streamId: 'stream-update-1',
      filePath: 'script.md',
      kind: 'update',
      phase: 'streaming',
    };

    const html = renderToStaticMarkup(<AgentProgressBar />);

    expect(html).toContain('AI 正在更新文稿');
    expect(html).toContain('正在把改动逐段写入编辑器');
    expect(html).not.toContain('0%');
  });
});
