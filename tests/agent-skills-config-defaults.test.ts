import { describe, it, expect } from 'vitest';
import { ensureDefaultAgents } from '../electron/acp/config';

describe('ensureDefaultAgents skills 默认', () => {
  it('为 claude/codex/pi 补默认 skill 配置', () => {
    const agents = ensureDefaultAgents({});
    for (const id of ['claude', 'codex', 'pi']) {
      expect(agents[id].skills).toEqual([
        { id: 'lingji-video-workflow', enabled: true },
      ]);
    }
  });

  it('不覆盖用户已有 skills 配置', () => {
    const agents = ensureDefaultAgents({
      claude: {
        enabled: true, authMode: 'subscription', apiKey: '', apiBaseUrl: '',
        model: '', envText: '', configJson: '', version: '', sortOrder: 0,
        skills: [{ id: 'lingji-video-workflow', enabled: false }],
      },
    });
    expect(agents.claude.skills).toEqual([
      { id: 'lingji-video-workflow', enabled: false },
    ]);
  });
});
