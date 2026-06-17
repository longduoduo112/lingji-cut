import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import type {
  AgentSkillConfig,
  AgentSkillDefinition,
  AgentSkillStatus,
  ResolvedAgentSkill,
} from '../acp/types';
import { BUILTIN_SKILL_ID, LOAD_MODES_BY_AGENT } from './constants';
import { ensureBundledAgentSkills } from './bundled';
import { parseFrontmatter } from './frontmatter';

export interface SkillRegistryOptions {
  /** 内置种子根目录。 */
  seedRoot: string;
  /** 用户配置目录 ~/.lingji/agent-skills。 */
  targetRoot: string;
}

/** 默认元数据兜底（种子里 frontmatter/openai.yaml 缺字段时用）。 */
const BUILTIN_DEFAULTS: Record<string, { displayName: string; description: string }> = {
  [BUILTIN_SKILL_ID]: {
    displayName: '灵机剪影视频工作流',
    description: '连接稿件输入、灵机剪影项目生成、视频精修与导出协作流程',
  },
};

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** 读 agents/openai.yaml 的 interface.display_name / short_description（可选）。 */
async function readOpenAiInterface(
  skillDir: string,
): Promise<{ displayName?: string; description?: string }> {
  const p = path.join(skillDir, 'agents', 'openai.yaml');
  try {
    const raw = await fs.readFile(p, 'utf-8');
    const parsed = YAML.parse(raw) as { interface?: Record<string, unknown> } | null;
    const iface = parsed?.interface ?? {};
    const displayName =
      typeof iface.display_name === 'string' ? iface.display_name.trim() : undefined;
    const description =
      typeof iface.short_description === 'string'
        ? iface.short_description.trim()
        : undefined;
    return { displayName, description };
  } catch {
    return {};
  }
}

/**
 * 内置 skill registry（main 侧）。
 * 职责单一：确保种子已复制、解析元数据、按 agent + 配置返回 enabled skills、
 * 读取主 SKILL.md 供 $skill 注入。Renderer 不直接读文件，只经 IPC 拿元数据。
 */
export class SkillRegistry {
  private readonly seedRoot: string;
  private readonly targetRoot: string;
  private ensured = false;

  constructor(opts: SkillRegistryOptions) {
    this.seedRoot = opts.seedRoot;
    this.targetRoot = opts.targetRoot;
  }

  /** 幂等确保种子已复制（首次调用真正复制，之后跳过）。 */
  async ensureBundled(): Promise<void> {
    if (this.ensured) return;
    try {
      await ensureBundledAgentSkills({
        seedRoot: this.seedRoot,
        targetRoot: this.targetRoot,
      });
    } catch (err) {
      console.warn('[agent-skills] ensureBundled 失败:', err);
    }
    this.ensured = true;
  }

  /** 返回全部内置 skill 定义；种子/用户目录都缺失时返回空数组。 */
  async list(): Promise<AgentSkillDefinition[]> {
    await this.ensureBundled();
    const def = await this.readDefinition(BUILTIN_SKILL_ID);
    return def ? [def] : [];
  }

  private async readDefinition(id: string): Promise<AgentSkillDefinition | null> {
    const rootPath = path.join(this.targetRoot, id);
    const skillFilePath = path.join(rootPath, 'SKILL.md');
    if (!(await exists(skillFilePath))) return null;

    const fallback = BUILTIN_DEFAULTS[id] ?? { displayName: id, description: '' };
    let displayName = fallback.displayName;
    let description = fallback.description;

    try {
      const raw = await fs.readFile(skillFilePath, 'utf-8');
      const fm = parseFrontmatter(raw);
      if (fm?.description) description = fm.description;
    } catch {
      // 读取失败用兜底
    }
    const iface = await readOpenAiInterface(rootPath);
    if (iface.displayName) displayName = iface.displayName;
    if (iface.description) description = iface.description;

    return {
      id,
      displayName,
      description,
      source: 'builtin',
      rootPath,
      skillFilePath,
      defaultEnabled: true,
      loadModesByAgent: LOAD_MODES_BY_AGENT,
    };
  }

  /**
   * 按 agent + 已保存配置返回 resolved skills。
   * 未知 id 的配置项忽略（不出现在结果里，原值保留在配置文件由 config 层负责）。
   */
  async resolveForAgent(
    _agentId: string,
    configs: AgentSkillConfig[] | undefined,
  ): Promise<ResolvedAgentSkill[]> {
    const defs = await this.list();
    const byId = new Map((configs ?? []).map((c) => [c.id, c]));
    return defs.map((def) => {
      const cfg = byId.get(def.id);
      const enabled = cfg ? cfg.enabled : def.defaultEnabled;
      const status: AgentSkillStatus = 'available';
      return { ...def, enabled, status };
    });
  }

  /** 读取主 SKILL.md 内容（供 $skill 注入）；失败抛错由上层兜底。 */
  async readSkillMarkdown(id: string): Promise<string> {
    await this.ensureBundled();
    const skillFilePath = path.join(this.targetRoot, id, 'SKILL.md');
    return fs.readFile(skillFilePath, 'utf-8');
  }
}
