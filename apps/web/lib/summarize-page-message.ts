/**
 * 与 `apps/extensions/lib/summarize-page-message.ts` 中前缀/解析逻辑保持一致，
 * 主站仅用于展示扩展「总结网页」同步过来的用户消息。
 */
export type SummarizePageMeta = {
  favIconUrl?: string;
  title: string;
  url: string;
};

const SUMMARIZE_PREFIX = "<!--SUMMARIZE_PAGE:";
const SUMMARIZE_SUFFIX = "-->";

export function parseSummarizePageMeta(
  text: string,
): SummarizePageMeta | null {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith(SUMMARIZE_PREFIX)) {
    return null;
  }
  const endIdx = trimmed.indexOf(SUMMARIZE_SUFFIX, SUMMARIZE_PREFIX.length);
  if (endIdx === -1) {
    return null;
  }
  try {
    return JSON.parse(
      trimmed.slice(SUMMARIZE_PREFIX.length, endIdx),
    ) as SummarizePageMeta;
  } catch {
    return null;
  }
}
