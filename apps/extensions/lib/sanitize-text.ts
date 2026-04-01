/** 与主站 `apps/web/lib/utils.ts` 的 `sanitizeText` 一致，避免工具调用占位符破坏 Markdown。 */
export function sanitizeText(text: string): string {
  return text
    .replace("<has_function_call>", "")
    .replace(/<(\/?)(invoke|parameter)(?:\s[^>]*)?>/g, (match) =>
      match.replace("<", "&lt;").replace(">", "&gt;"),
    );
}
