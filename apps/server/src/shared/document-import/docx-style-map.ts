export const DEFAULT_DOCX_STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='标题 1'] => h1:fresh",
  "p[style-name='标题 2'] => h2:fresh",
  "p[style-name='标题 3'] => h3:fresh",
] as const;

export function getDocxStyleMap(): string[] {
  const custom = process.env.DOCX_STYLE_MAP?.trim();
  if (!custom) {
    return [...DEFAULT_DOCX_STYLE_MAP];
  }

  try {
    const parsed = JSON.parse(custom) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.every((entry) => typeof entry === "string")
    ) {
      return [...DEFAULT_DOCX_STYLE_MAP, ...parsed];
    }
  } catch {
    return [...DEFAULT_DOCX_STYLE_MAP];
  }

  return [...DEFAULT_DOCX_STYLE_MAP];
}
