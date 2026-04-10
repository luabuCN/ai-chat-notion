/** 与 content script 约定的 Readability 提取消息 */

export const READABILITY_EXTRACT_MESSAGE = "wisewrite/extractReadability" as const;

export type ReadabilityExtractRequest = {
  type: typeof READABILITY_EXTRACT_MESSAGE;
};

/** 与 @mozilla/readability parse 结果对齐的可序列化字段 */
export type ReadabilityArticlePayload = {
  byline: string | null;
  content: string | null;
  dir: string | null;
  excerpt: string | null;
  lang: string | null;
  length: number | null;
  publishedTime: string | null;
  siteName: string | null;
  textContent: string | null;
  title: string | null;
};

export type ReadabilityExtractResponse =
  | { article: ReadabilityArticlePayload | null; ok: true }
  | { error: string; ok: false };
