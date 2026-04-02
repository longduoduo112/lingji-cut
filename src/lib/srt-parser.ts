import type { SrtEntry } from '../types';

function timeToMs(timestamp: string): number {
  const [hours, minutes, secondsAndMs] = timestamp.split(':');
  const [seconds, milliseconds] = secondsAndMs.split(',');

  return (
    Number.parseInt(hours, 10) * 3_600_000 +
    Number.parseInt(minutes, 10) * 60_000 +
    Number.parseInt(seconds, 10) * 1_000 +
    Number.parseInt(milliseconds, 10)
  );
}

export function parseSrt(content: string): SrtEntry[] {
  if (!content.trim()) {
    return [];
  }

  const blocks = content.trim().split(/\r?\n\s*\r?\n/);
  const entries: SrtEntry[] = [];

  for (const block of blocks) {
    const lines = block.trim().split(/\r?\n/);
    if (lines.length < 3) {
      continue;
    }

    const index = Number.parseInt(lines[0], 10);
    if (Number.isNaN(index)) {
      continue;
    }

    const match = lines[1].match(
      /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/,
    );
    if (!match) {
      continue;
    }

    entries.push({
      index,
      startMs: timeToMs(match[1]),
      endMs: timeToMs(match[2]),
      text: lines.slice(2).join('\n'),
    });
  }

  return entries;
}
