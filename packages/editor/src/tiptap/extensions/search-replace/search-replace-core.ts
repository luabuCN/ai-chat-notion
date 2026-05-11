export interface PlainTextMatch {
  from: number;
  to: number;
}

export function findPlainTextMatches(
  text: string,
  searchTerm: string
): PlainTextMatch[] {
  if (searchTerm.length === 0) {
    return [];
  }

  const haystack = text.toLocaleLowerCase();
  const needle = searchTerm.toLocaleLowerCase();
  const matches: PlainTextMatch[] = [];
  let from = haystack.indexOf(needle);

  while (from !== -1) {
    const to = from + needle.length;
    matches.push({ from, to });
    from = haystack.indexOf(needle, to);
  }

  return matches;
}

export function clampMatchIndex(index: number, matchCount: number): number {
  if (matchCount <= 0) {
    return 0;
  }
  if (index < 0) {
    return 0;
  }
  if (index >= matchCount) {
    return matchCount - 1;
  }
  return index;
}

export function replaceCurrentPlainTextMatch(
  text: string,
  searchTerm: string,
  replaceTerm: string,
  currentIndex: number
): { text: string; nextIndex: number; replaced: boolean } {
  const matches = findPlainTextMatches(text, searchTerm);
  if (matches.length === 0) {
    return { text, nextIndex: 0, replaced: false };
  }

  const match = matches[clampMatchIndex(currentIndex, matches.length)];
  const nextText = `${text.slice(0, match.from)}${replaceTerm}${text.slice(
    match.to
  )}`;
  const nextMatches = findPlainTextMatches(nextText, searchTerm);

  return {
    text: nextText,
    nextIndex: clampMatchIndex(currentIndex, nextMatches.length),
    replaced: true,
  };
}

export function replacePlainTextMatches(
  text: string,
  searchTerm: string,
  replaceTerm: string
): { text: string; replacedCount: number } {
  const matches = findPlainTextMatches(text, searchTerm);
  if (matches.length === 0) {
    return { text, replacedCount: 0 };
  }

  let nextText = text;
  for (const match of matches.toReversed()) {
    nextText = `${nextText.slice(0, match.from)}${replaceTerm}${nextText.slice(
      match.to
    )}`;
  }

  return { text: nextText, replacedCount: matches.length };
}
