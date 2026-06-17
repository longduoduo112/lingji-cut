import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SkillRegistry } from '../electron/agent-skills/registry';

let seedRoot = '';
let targetRoot = '';

async function makeSeed(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'reg-seed-'));
  const skill = path.join(dir, 'lingji-video-workflow');
  await fs.mkdir(path.join(skill, 'agents'), { recursive: true });
  await fs.writeFile(
    path.join(skill, 'SKILL.md'),
    '---\nname: lingji-video-workflow\ndescription: 测试描述\n---\n# 正文\nHELLO',
    'utf-8',
  );
  await fs.writeFile(
    path.join(skill, 'agents', 'openai.yaml'),
    'interface:\n  display_name: "灵机剪影视频工作流"\n  short_description: "短说明"\n',
    'utf-8',
  );
  return dir;
}

beforeEach(async () => {
  seedRoot = await makeSeed();
  targetRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'reg-target-'));
});
afterEach(async () => {
  await fs.rm(seedRoot, { recursive: true, force: true });
  await fs.rm(targetRoot, { recursive: true, force: true });
});

describe('SkillRegistry', () => {
  it('list() 复制种子并解析元数据（openai.yaml display_name 优先）', async () => {
    const reg = new SkillRegistry({ seedRoot, targetRoot });
    const defs = await reg.list();
    expect(defs).toHaveLength(1);
    expect(defs[0].id).toBe('lingji-video-workflow');
    expect(defs[0].displayName).toBe('灵机剪影视频工作流');
    expect(defs[0].description).toBe('短说明');
    expect(defs[0].source).toBe('builtin');
    expect(defs[0].rootPath).toBe(path.join(targetRoot, 'lingji-video-workflow'));
    expect(defs[0].loadModesByAgent.pi).toContain('native');
  });

  it('resolveForAgent 合并 enabled，未知 id 忽略', async () => {
    const reg = new SkillRegistry({ seedRoot, targetRoot });
    const resolved = await reg.resolveForAgent('pi', [
      { id: 'lingji-video-workflow', enabled: false },
      { id: 'unknown-skill', enabled: true },
    ]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].enabled).toBe(false);
    expect(resolved[0].status).toBe('available');
  });

  it('无配置时按 defaultEnabled 解析（默认启用）', async () => {
    const reg = new SkillRegistry({ seedRoot, targetRoot });
    const resolved = await reg.resolveForAgent('claude', undefined);
    expect(resolved[0].enabled).toBe(true);
  });

  it('readSkillMarkdown 返回主 SKILL.md 内容', async () => {
    const reg = new SkillRegistry({ seedRoot, targetRoot });
    const md = await reg.readSkillMarkdown('lingji-video-workflow');
    expect(md).toContain('HELLO');
  });

  it('种子缺失时 list() 返回空数组（不抛错）', async () => {
    const reg = new SkillRegistry({
      seedRoot: path.join(seedRoot, 'nope'),
      targetRoot,
    });
    expect(await reg.list()).toEqual([]);
  });
});
