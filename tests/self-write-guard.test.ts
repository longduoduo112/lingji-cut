import { describe, it, expect } from 'vitest';
import { markSelfWrite, consumeSelfWrite } from '../electron/ai-edit/self-write-guard';

describe('self-write-guard', () => {
  it('相同内容判为自写并一次性消费', () => {
    markSelfWrite('/p/project.json', 'X');
    expect(consumeSelfWrite('/p/project.json', 'X')).toBe(true);
    // 已消费，第二次不再命中
    expect(consumeSelfWrite('/p/project.json', 'X')).toBe(false);
  });
  it('不同内容不判为自写（真实外部编辑放行）', () => {
    markSelfWrite('/p/project.json', 'X');
    expect(consumeSelfWrite('/p/project.json', 'Y')).toBe(false);
  });
  it('未记录的路径不判为自写', () => {
    expect(consumeSelfWrite('/p/other.json', 'Z')).toBe(false);
  });
});
