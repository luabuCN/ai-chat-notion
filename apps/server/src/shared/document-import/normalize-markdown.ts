const BOM = /^\uFEFF/;
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const DANGEROUS_SCRIPT_RE = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
const DANGEROUS_EVENT_ATTR_RE = /\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JAVASCRIPT_URL_RE = /\]\(javascript:[^)]*\)/gi;

export type MarkdownNormalizationResult = {
  markdown: string;
  hadFrontmatter: boolean;
};

export function stripFrontmatter(input: string): MarkdownNormalizationResult {
  const withoutBom = input.replace(BOM, "");
  const match = FRONTMATTER_RE.exec(withoutBom);
  if (!match) {
    return { markdown: withoutBom, hadFrontmatter: false };
  }

  return {
    markdown: withoutBom.slice(match[0].length),
    hadFrontmatter: true,
  };
}

function stripDangerousMarkdownContent(input: string): string {
  return input
    .replace(DANGEROUS_SCRIPT_RE, "")
    .replace(DANGEROUS_EVENT_ATTR_RE, "")
    .replace(JAVASCRIPT_URL_RE, "](#)");
}

function normalizeMarkdownBody(input: string): string {
  return stripDangerousMarkdownContent(input)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export function normalizeMarkdown(input: string): string {
  const { markdown } = stripFrontmatter(input);
  return normalizeMarkdownBody(markdown);
}

export function markdownFromBuffer(buffer: ArrayBuffer): MarkdownNormalizationResult {
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  const { markdown, hadFrontmatter } = stripFrontmatter(decoded);

  return {
    markdown: normalizeMarkdownBody(markdown),
    hadFrontmatter,
  };
}
