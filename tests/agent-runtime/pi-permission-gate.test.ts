/**
 * tests/agent-runtime/pi-permission-gate.test.ts
 *
 * 审批门控纯函数：
 *   - classifyConfirmRisk()：把一次 pi confirm 请求（含关联工具）判为 risky / benign。
 *   - decidePermission()：按策略（auto_approve / tiered / always_ask）+ 风险等级
 *     决定 auto_allow（自动放行）还是 ask（弹卡片询问）。
 */

import { describe, it, expect } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import {
  classifyConfirmRisk,
  decidePermission,
} from '../../electron/agent-runtime/pi-permission';

describe('decidePermission', () => {
  it('auto_approve 总是 auto_allow（不论风险）', () => {
    expect(decidePermission('auto_approve', 'risky')).toBe('auto_allow');
    expect(decidePermission('auto_approve', 'benign')).toBe('auto_allow');
  });

  it('always_ask 总是 ask（不论风险）', () => {
    expect(decidePermission('always_ask', 'risky')).toBe('ask');
    expect(decidePermission('always_ask', 'benign')).toBe('ask');
  });

  it('tiered 仅对 risky 询问，benign 自动放行', () => {
    expect(decidePermission('tiered', 'risky')).toBe('ask');
    expect(decidePermission('tiered', 'benign')).toBe('auto_allow');
  });

  it('未知策略回退 tiered 语义', () => {
    expect(decidePermission('whatever', 'risky')).toBe('ask');
    expect(decidePermission('whatever', 'benign')).toBe('auto_allow');
  });
});

describe('classifyConfirmRisk', () => {
  const cwd = path.join(os.tmpdir(), 'lingji-proj');

  it('执行类工具（bash/shell/命令）判为 risky', () => {
    expect(
      classifyConfirmRisk({ toolName: 'bash', toolInput: { command: 'ls -la' }, cwd }),
    ).toBe('risky');
    expect(classifyConfirmRisk({ toolName: 'run_shell', toolInput: {}, cwd })).toBe('risky');
  });

  it('网络/抓取类工具判为 risky', () => {
    expect(classifyConfirmRisk({ toolName: 'fetch_url', toolInput: {}, cwd })).toBe('risky');
  });

  it('confirm 文案含 URL / curl / wget 时判为 risky（即使工具名缺失）', () => {
    expect(
      classifyConfirmRisk({ message: '将访问 https://example.com/data', cwd }),
    ).toBe('risky');
    expect(classifyConfirmRisk({ message: 'curl -X POST ...', cwd })).toBe('risky');
  });

  it('删除类操作判为 risky', () => {
    expect(
      classifyConfirmRisk({ toolName: 'delete_file', toolInput: { path: 'a.txt' }, cwd }),
    ).toBe('risky');
    expect(
      classifyConfirmRisk({ message: 'Run command: rm -rf build', cwd }),
    ).toBe('risky');
  });

  it('项目内文件编辑判为 benign', () => {
    expect(
      classifyConfirmRisk({
        toolName: 'edit',
        toolInput: { path: 'src/index.ts', old_string: 'a', new_string: 'b' },
        cwd,
      }),
    ).toBe('benign');
  });

  it('项目外文件编辑判为 risky', () => {
    expect(
      classifyConfirmRisk({
        toolName: 'write',
        toolInput: { path: '/etc/hosts', new_string: 'x' },
        cwd,
      }),
    ).toBe('risky');
  });

  it('纯读取类工具判为 benign', () => {
    expect(
      classifyConfirmRisk({ toolName: 'read_file', toolInput: { path: 'src/index.ts' }, cwd }),
    ).toBe('benign');
  });

  it('无法判定（无工具名、无可识别文案）时从严判为 risky', () => {
    expect(classifyConfirmRisk({ message: '继续吗？', cwd })).toBe('risky');
    expect(classifyConfirmRisk({})).toBe('risky');
  });
});
