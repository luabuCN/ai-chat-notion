import type { ReadabilityExtractResponse } from "@/lib/readability-messages";
import { READABILITY_EXTRACT_MESSAGE } from "@/lib/readability-messages";

/**
 * 向当前标签页的内容脚本请求用 Readability 解析正文（须在普通网页、且已注入 content script）。
 */
export async function extractReadabilityFromTab(
  tabId: number,
): Promise<ReadabilityExtractResponse> {
  try {
    const response = (await browser.tabs.sendMessage(tabId, {
      type: READABILITY_EXTRACT_MESSAGE,
    })) as ReadabilityExtractResponse | undefined;
    if (!response) {
      return { error: "未收到内容脚本响应", ok: false };
    }
    return response;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { error: message, ok: false };
  }
}

