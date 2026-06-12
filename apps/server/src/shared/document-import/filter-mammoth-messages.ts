const IGNORABLE_MAMMOTH_MESSAGE_PATTERNS = [
  /^An unrecognised element was ignored:/i,
  /^A v:imagedata element without a relationship ID was ignored/i,
  /^Unrecognised paragraph style:/i,
  /^Unrecognised run style:/i,
];

export function filterMammothMessages(messages: string[]): string[] {
  return messages.filter((message) => {
    const trimmed = message.trim();
    return !IGNORABLE_MAMMOTH_MESSAGE_PATTERNS.some((pattern) =>
      pattern.test(trimmed)
    );
  });
}
