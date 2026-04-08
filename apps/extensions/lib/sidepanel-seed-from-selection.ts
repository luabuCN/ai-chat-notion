import type { UIMessage } from "ai";

/** 与 `browser.storage.session` 键一致，供 background 写入与侧栏读取 */
export const SIDEPANEL_SEED_FROM_SELECTION_KEY = "sidepanelSeedFromSelection";

export type SidepanelSeedFromSelectionPayload = {
  chatId: string;
  messages: UIMessage[];
};

function buildUserMessageText(selectedText: string, userQuery: string): string {
  const q = userQuery.trim();
  const sel = selectedText.trim();
  if (sel.length === 0) {
    return q;
  }
  if (q.length === 0) {
    return sel;
  }
  return ["【选中文本】", sel, "", "【问题】", q].join("\n");
}

/**
 * 将划词浮层中的首轮问答转为侧栏 `UIMessage[]`（与主站 / 扩展侧栏 transport 一致）。
 * 用户气泡内先展示划词内容，再展示问题（与浮层内结构一致）。
 */
export function buildSidepanelSeedFromSelectionMessages(
  selectedText: string,
  userQuery: string,
  assistantAnswer: string,
): SidepanelSeedFromSelectionPayload {
  const chatId = crypto.randomUUID();
  const userText = buildUserMessageText(selectedText, userQuery);
  const messages: UIMessage[] = [
    {
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", text: userText }],
    },
  ];
  if (assistantAnswer.trim().length > 0) {
    messages.push({
      id: crypto.randomUUID(),
      role: "assistant",
      parts: [{ type: "text", text: assistantAnswer.trim() }],
    });
  }
  return { chatId, messages };
}
