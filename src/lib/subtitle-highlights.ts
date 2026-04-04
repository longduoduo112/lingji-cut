import type { SrtEntry, SubtitleHighlight } from '../types';

export function isValidSubtitleHighlight(
  entry: SrtEntry | undefined,
  highlight: SubtitleHighlight,
): boolean {
  if (!entry || entry.index !== highlight.entryIndex) {
    return false;
  }

  if (highlight.start < 0 || highlight.end <= highlight.start) {
    return false;
  }

  if (highlight.end > highlight.sourceText.length) {
    return false;
  }

  return highlight.highlightText === highlight.sourceText.slice(highlight.start, highlight.end);
}

export function isExpiredSubtitleHighlight(
  entry: SrtEntry | undefined,
  highlight: SubtitleHighlight,
): boolean {
  if (!entry || entry.index !== highlight.entryIndex) {
    return true;
  }

  return entry.text !== highlight.sourceText;
}

export function filterValidSubtitleHighlights(
  entries: SrtEntry[],
  highlights: SubtitleHighlight[],
): SubtitleHighlight[] {
  const entryMap = new Map(entries.map((entry) => [entry.index, entry]));

  return highlights.filter((highlight) => {
    const entry = entryMap.get(highlight.entryIndex);
    return isValidSubtitleHighlight(entry, highlight) && !isExpiredSubtitleHighlight(entry, highlight);
  });
}
