const FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v2/scrape";

/** 通用排除选择器：评论、侧边栏、推荐区等 */
const DEFAULT_EXCLUDE_TAGS = [
  "#comments",
  ".comments",
  ".comment-list",
  ".comment-area",
  ".comment-section",
  ".comment-box",
  "[class*='comment']",
  "[id*='comment']",
  "aside",
  ".sidebar",
  ".side-bar",
  "[class*='side-bar']",
  "[class*='related']",
  "[class*='recommend']",
  "footer",
  "nav",
] as const;

export type FirecrawlScrapeOptions = {
  excludeTags?: string[];
  includeTags?: string[];
  onlyMainContent?: boolean;
  onlyCleanContent?: boolean;
};

export type FirecrawlScrapeMetadata = {
  title?: string;
  description?: string;
  language?: string;
  sourceURL?: string;
  statusCode?: number;
  error?: string;
  [key: string]: unknown;
};

export type FirecrawlScrapeData = {
  markdown?: string;
  html?: string;
  rawHtml?: string;
  summary?: string;
  warning?: string;
  metadata?: FirecrawlScrapeMetadata;
};

export type FirecrawlScrapeResponse = {
  success: boolean;
  data?: FirecrawlScrapeData;
  error?: string;
};

export async function scrapeUrlWithFirecrawl(
  url: string,
  apiKey: string,
  options: FirecrawlScrapeOptions = {}
): Promise<FirecrawlScrapeData> {
  const excludeTags = [
    ...DEFAULT_EXCLUDE_TAGS,
    ...(options.excludeTags ?? []),
  ];

  const response = await fetch(FIRECRAWL_SCRAPE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      onlyMainContent: options.onlyMainContent ?? true,
      onlyCleanContent: options.onlyCleanContent ?? true,
      excludeTags,
      ...(options.includeTags?.length ? { includeTags: options.includeTags } : {}),
      maxAge: 172_800_000,
      blockAds: true,
      parsers: ["pdf"],
      formats: ["markdown"],
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | FirecrawlScrapeResponse
    | null;

  if (!response.ok) {
    const message =
      payload?.error ??
      (typeof payload === "object" && payload !== null && "message" in payload
        ? String((payload as { message?: string }).message)
        : null) ??
      `Firecrawl 请求失败（${response.status}）`;
    throw new Error(message);
  }

  if (!payload?.success || !payload.data) {
    throw new Error(payload?.error ?? "Firecrawl 未返回有效内容");
  }

  const markdown = payload.data.markdown?.trim();
  if (!markdown) {
    throw new Error("未能从该网页提取正文内容");
  }

  return payload.data;
}

export function resolveScrapeTitle(
  sourceUrl: string,
  metadata?: FirecrawlScrapeMetadata
): string {
  const fromMetadata = metadata?.title?.trim();
  if (fromMetadata) {
    return fromMetadata.slice(0, 200);
  }

  try {
    const parsed = new URL(sourceUrl);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${parsed.hostname}${path}`.slice(0, 200);
  } catch {
    return sourceUrl.slice(0, 200);
  }
}
