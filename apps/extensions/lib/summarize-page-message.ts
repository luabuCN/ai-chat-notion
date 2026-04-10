export type SummarizePageMeta = {
  favIconUrl?: string;
  title: string;
  url: string;
};

const SUMMARIZE_PREFIX = "<!--SUMMARIZE_PAGE:";
const SUMMARIZE_SUFFIX = "-->";

/** 与 `apps/web/app/api/chat/schema.ts` 中单条 text part 上限一致，避免请求体校验失败 */
export const MAX_SUMMARIZE_MESSAGE_CHARS = 100_000;

export function encodeSummarizePageMessage(
  meta: SummarizePageMeta,
  articleText: string,
): string {
  const metaJson = JSON.stringify(meta);
  const header = [
    `${SUMMARIZE_PREFIX}${metaJson}${SUMMARIZE_SUFFIX}`,
    "请帮我总结以下网页的内容。",
    "",
    `网页标题：${meta.title}`,
    `网页链接：${meta.url}`,
    "",
    "正文内容：",
  ].join("\n");
  /** 与原先 `join("\n")` 一致：`正文内容：` 与正文之间有一换行 */
  const prefix = `${header}\n`;
  const truncationNote = "\n\n[正文已截断：超过单条消息长度上限]";
  const maxArticle = Math.max(
    0,
    MAX_SUMMARIZE_MESSAGE_CHARS - prefix.length - truncationNote.length,
  );
  const body =
    articleText.length > maxArticle
      ? `${articleText.slice(0, maxArticle)}${truncationNote}`
      : articleText;
  return prefix + body;
}

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
