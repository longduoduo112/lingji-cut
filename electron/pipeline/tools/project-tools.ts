import fs from 'node:fs/promises';
import path from 'node:path';
import { createDefaultProjectData } from '../../../src/lib/project-persistence';
import { computeProjectState, type ProjectStateSnapshot } from '../algorithms/project-state';
import { resolveProject } from '../context';
import { PIPELINE_ERROR_CODES } from '../types';

class PipelineError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export interface CreateProjectInput {
  path: string;
  options?: { name?: string; meta?: Record<string, unknown> };
}

export interface CreateProjectOutput {
  projectPath: string;
}

async function isEmptyDir(dir: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dir);
    return entries.length === 0;
  } catch {
    return true; // 不存在视为可创建
  }
}

async function dirExists(dir: string): Promise<boolean> {
  try {
    const st = await fs.stat(dir);
    return st.isDirectory();
  } catch {
    return false;
  }
}

export async function createProject(input: CreateProjectInput): Promise<CreateProjectOutput> {
  if (!path.isAbsolute(input.path)) {
    throw new PipelineError(
      PIPELINE_ERROR_CODES.INVALID_PROJECT,
      'path 必须为绝对路径',
    );
  }
  const target = input.path;
  const exists = await dirExists(target);
  if (exists && !(await isEmptyDir(target))) {
    throw new PipelineError(
      PIPELINE_ERROR_CODES.INVALID_PROJECT,
      `目标目录非空: ${target}`,
    );
  }

  await fs.mkdir(target, { recursive: true });
  await Promise.all([
    fs.mkdir(path.join(target, 'covers'), { recursive: true }),
    fs.mkdir(path.join(target, 'ai-cards'), { recursive: true }),
    fs.mkdir(path.join(target, 'configs/prompts'), { recursive: true }),
  ]);

  const data = createDefaultProjectData();
  await fs.writeFile(
    path.join(target, 'project.json'),
    JSON.stringify(data, null, 2),
    'utf-8',
  );
  await fs.writeFile(path.join(target, 'original.md'), '', 'utf-8');

  return { projectPath: target };
}

export async function getProjectState(input: { projectPath: string }): Promise<ProjectStateSnapshot> {
  await resolveProject(input.projectPath);
  return computeProjectState(input.projectPath);
}

export async function openProject(input: { path: string }): Promise<{ ok: true }> {
  await resolveProject(input.path);
  return { ok: true };
}
