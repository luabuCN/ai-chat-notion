import { runModelScopeChat } from "@/lib/ai/modelscope-chat";

/** PDF 转文档后的 Markdown 润色说明（仅文档生成流程使用，公共 API 由调用方自带提示词） */
const PDF_POLISH_SYSTEM_PROMPT = `你是一个专业的 PDF 转 Markdown 格式优化专家。我会给你一段由 PDF 解析出的原始 Markdown。这段内容由于解析算法限制，可能存在表格对齐混乱、标题层级不准、列表项错乱等问题。

## 输出格式（必须严格遵守）
- 你只输出**一份合法的 Markdown 文档正文**，不要输出任何其它包装。
- **禁止**输出 JSON、YAML、键值对、代码块围栏外的说明文字、开场白、结束语（例如「以下是」「优化结果：」）。
- **禁止**用自然语言标题代替 Markdown 语法：如「一、」「二、」「亮点一：」等必须改写为 ATX 标题（见下条），层级与文档结构一致。
- **【标题与段落 — 极其重要】**
  - 文档开头的**长句说明、摘要、定义性引言**（通常是一整句或一段话）必须写成**普通段落**，**不要**加 \`#\`。
  - \`#\` **一级标题**仅用于极少数情况：原文最前面有**单独一行、且很短的正式文档标题**（例如少于约 30 字）。若原文没有这种短文标题，**不要使用 \`#\`**，直接从普通段落开始即可。
  - 章节名、小节名（如「核心特点」「工作原理」「一、xxx」改写后）请用 \`##\` 或 \`###\`，**不要用 \`#\`**，以免整页只有巨大一级标题、阅读体验差。
  - 不要把多句说明、长段落误标成一级标题。
- **段落**：普通文字使用空行分隔的段落；不要整篇粘成一段不换行。
- **列表**：无序列表统一用 \`- \`，有序列表用 \`1. \`，缩进表示嵌套。
- **表格**：仅使用标准 GFM 表格（表头 + \`|---|\` 分隔行）。
- **链接与图片**：\`[text](url)\`、\`![alt](url)\` 保持 URL 原样；图片标签必须完整保留，不得删改。

## 你的任务
1. **修复表格**：识别潜在表格数据，整理为标准 Markdown 表格。
2. **规范标题**：章节用 \`##\`/\`###\`；保留原文的引言为**无 \`#\` 前缀的段落**。
3. **整理列表**：符号统一、缩进正确。
4. **图片保护**：所有 \`![...](...)\` 原样保留，仅调整其在文中的位置与上下文。
5. **直接输出**：从第一段正文或第一个 \`##\` 标题开始输出（除非确有短文档标题才用单独一行 \`#\`），到最后一段或列表结束，中间不要夹杂任何元说明。`;

/**
 * 从模型返回中尽量还原「纯 Markdown」：去围栏、解析误输出的 JSON 包装。
 */
function normalizePolishedMarkdown(raw: string): string {
  let s = raw.trim();
  if (!s) {
    return s;
  }

  const fenced = /^```(?:markdown|md)?\s*\r?\n?([\s\S]*?)\r?\n?```\s*$/i.exec(s);
  if (fenced) {
    s = fenced[1].trim();
  } else {
    s = s
      .replace(/^```(?:markdown|md)?\s*\r?\n?/i, "")
      .replace(/\r?\n?```\s*$/i, "")
      .trim();
  }

  if (s.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(s);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const o = parsed as Record<string, unknown>;
        for (const key of [
          "rawMarkdown",
          "markdown",
          "content",
          "text",
          "result",
          "output",
        ]) {
          const v = o[key];
          if (typeof v === "string" && v.trim()) {
            return normalizePolishedMarkdown(v);
          }
        }
      }
    } catch {
      // 非合法 JSON，沿用当前字符串
    }
  }

  return s;
}

/** 单行 \`# \` 且正文过长时，多为误把引言标成一级标题，降级为普通段落 */
const MAX_H1_LINE_CHARS = 60;

function demoteOversizedLeadingH1(md: string): string {
  const t = md.trimStart();
  if (!t.startsWith("# ") || t.startsWith("##")) {
    return md;
  }
  const nl = t.indexOf("\n");
  const firstLine = nl === -1 ? t : t.slice(0, nl);
  const body = firstLine.slice(2).trimStart();
  if (body.length <= MAX_H1_LINE_CHARS) {
    return md;
  }
  const rest = nl === -1 ? "" : t.slice(nl);
  return body + rest;
}

/**
 * PDF 解析管线：用上述系统提示 + 原始 Markdown 调用 ModelScope；失败或空结果则降级为原文。
 */
export async function polishWithAI(rawMd: string): Promise<string> {
  try {
    const text = await runModelScopeChat({
      system: PDF_POLISH_SYSTEM_PROMPT,
      prompt: `请严格按系统说明，只返回 Markdown 正文（不要 JSON、不要解释）。\n特别注意：开头的长句说明请保持为普通段落，不要用一级标题 #。\n\n原始 Markdown 如下：\n---\n${rawMd}\n---`,
      temperature: 0.1,
    });
    if (!text) {
      return rawMd;
    }

    const normalized = demoteOversizedLeadingH1(normalizePolishedMarkdown(text));
    return normalized || rawMd;
  } catch {
    return rawMd;
  }
}
