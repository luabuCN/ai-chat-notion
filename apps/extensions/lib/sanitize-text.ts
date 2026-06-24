/** 与主站 `apps/web/lib/utils.ts` 的 `sanitizeText` 一致，避免工具调用占位符破坏 Markdown。 */
const LEAKED_TOOL_NAMES = [
  "createDocument",
  "updateDocument",
  "getWeather",
  "viewDocument",
  "requestSuggestions",
] as const;

function stripLeakedToolCallText(text: string): string {
  let result = text
    .replace("<has_function_call>", "")
    .replace(
      /<\|(?:redacted_)?tool_calls_section_begin\|>[\s\S]*?<\|(?:redacted_)?tool_calls_section_end\|>/g,
      ""
    )
    .replace(
      /<\|(?:redacted_)?tool_call_begin(?:_kimi)?\|>[\s\S]*?<\|(?:redacted_)?tool_call_end(?:_kimi)?\|>/g,
      ""
    );

  for (const toolName of LEAKED_TOOL_NAMES) {
    result = result.replace(
      new RegExp(
        String.raw`const\s+\w+\s*=\s*require\(["']${toolName}["']\)\s*;?`,
        "gi"
      ),
      ""
    );
    result = result.replace(
      new RegExp(String.raw`${toolName}:\d+:\d+\s*\{[\s\S]*?\}`, "gi"),
      ""
    );
    result = result.replace(
      new RegExp(
        String.raw`functions\.${toolName}:\d+[\s\S]*?(?:\}|\])`,
        "gi"
      ),
      ""
    );
  }

  return result.trim();
}

export function sanitizeText(text: string): string {
  return stripLeakedToolCallText(text).replace(
    /<(\/?)(invoke|parameter)(?:\s[^>]*)?>/g,
    (match) => match.replace("<", "&lt;").replace(">", "&gt;")
  );
}
