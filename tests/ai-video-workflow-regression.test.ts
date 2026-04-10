import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('AI video workflow regressions', () => {
  it('guards stale or canceled TTS runs before surfacing workflow errors', () => {
    const source = readFileSync(
      new URL('../src/hooks/useAIVideoWorkflow.ts', import.meta.url),
      'utf8',
    );

    expect(source).toContain('const currentRequestId = workflowSession.requestId');
    expect(source).toContain('workflowSession.requestId !== currentRequestId');
    expect(source).toContain("requestId: currentRequestId");
  });

  it('invalidates persisted AI analysis after subtitle replacement entrypoints', () => {
    const appSource = readFileSync(
      new URL('../src/App.tsx', import.meta.url),
      'utf8',
    );
    const editorSource = readFileSync(
      new URL('../src/pages/Editor.tsx', import.meta.url),
      'utf8',
    );

    expect(appSource).toContain('createPersistedAIState(null, [])');
    expect(appSource).toContain('await invalidateAIAnalysis(currentProjectDir);');
    expect(editorSource).toContain('clearAIAnalysis();');
    expect(editorSource).toContain('await persistAIState(null);');
  });
});
