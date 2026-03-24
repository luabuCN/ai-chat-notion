import { generateText } from "ai";
import { getProviderWithModel } from "@repo/ai";
import type { LanguageModel } from "ai";

const SYSTEM_PROMPT = `你是一个专业的 PDF 转 Markdown 格式优化专家。我会给你一段由 PDF 解析出的原始 Markdown。这段内容由于解析算法限制，可能存在表格对齐混乱、标题层级不准、列表项错乱等问题。

你的任务是：
1. **修复表格**：识别出潜在的表格数据，并将其整理为标准的 Markdown 表格格式。
2. **规范标题**：根据内容逻辑，修复不合适的标题层级。
3. **整理列表**：确保列表项符号统一，缩进正确。
4. **【极其重要】图片保护**：原始文档中包含以 "![name](url)" 格式存在的图片标签。请务必**原封不动地保留**这些标签，不要修改其 URL，也不要删除它们。请根据上下文，将它们平滑地嵌入到优化后的段落之间。
5. **简洁返回**：不要给我任何开场白或解释，直接返回优化后的 Markdown 正文。`;

/** 指数退避等待 */
function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * 调用 AI 优化 Markdown，带手动指数退避重试。
 * AI SDK 默认重试间隔太短（秒级），moonshot 429 需要更长的等待。
 * 失败时降级返回原始 markdown，不阻断整个流程。
 */
export async function polishWithAI(rawMd: string): Promise<string> {
  // moonshot-v1-128k 支持更大上下文，避免大 PDF 超限
  const model = getProviderWithModel("moonshot-v1-128k") as unknown as LanguageModel;

  const maxAttempts = 3;
  // 初始等待 10s，每次翻倍：10s → 20s → 40s
  const baseDelayMs = 10_000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { text } = await generateText({
        model,
        system: SYSTEM_PROMPT,
        prompt: `原始 Markdown 如下：\n---\n${rawMd}\n---`,
        temperature: 0.1,
        // 关闭 AI SDK 内置重试，由外层手动控制退避节奏
        maxRetries: 0,
      });

      return text
        .trim()
        .replace(/^```markdown\n?/i, "")
        .replace(/\n?```$/i, "");
    } catch (err) {
      const isRateLimit =
        err instanceof Error &&
        (err.message.includes("429") ||
          err.message.includes("overloaded") ||
          err.message.includes("rate") ||
          (err as { statusCode?: number }).statusCode === 429);

      if (isRateLimit && attempt < maxAttempts) {
        const waitMs = baseDelayMs * 2 ** (attempt - 1);
        console.warn(
          `[polishWithAI] 429 rate limit，第 ${attempt} 次重试，等待 ${waitMs / 1000}s...`
        );
        await sleep(waitMs);
        continue;
      }

      // 非限流错误或已达最大重试次数：降级返回原始 markdown
      console.error("[polishWithAI] AI 优化失败，降级返回原始内容:", err);
      return rawMd;
    }
  }

  // 所有重试耗尽，降级
  return rawMd;
}
