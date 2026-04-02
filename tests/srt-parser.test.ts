import { describe, expect, it } from 'vitest';
import { parseSrt } from '../src/lib/srt-parser';

const SAMPLE_SRT = `1
00:00:01,000 --> 00:00:03,500
大家好，我是一叶知秋

2
00:00:04,000 --> 00:00:07,200
今天我们来聊一个话题
`;

describe('parseSrt', () => {
  it('parses standard srt content', () => {
    const entries = parseSrt(SAMPLE_SRT);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      index: 1,
      startMs: 1000,
      endMs: 3500,
      text: '大家好，我是一叶知秋',
    });
    expect(entries[1]).toEqual({
      index: 2,
      startMs: 4000,
      endMs: 7200,
      text: '今天我们来聊一个话题',
    });
  });

  it('returns an empty array for empty input', () => {
    expect(parseSrt('')).toEqual([]);
  });

  it('preserves multi-line subtitle text', () => {
    const entries = parseSrt(`1
00:00:00,000 --> 00:00:02,000
第一行
第二行
`);

    expect(entries[0]?.text).toBe('第一行\n第二行');
  });
});
