/** 与主站 `apps/web/messages/zh.json` 中 `Chat.greeting` / 时段文案一致 */

export function getSidepanelTimeWord(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return "上午好";
  }
  if (hour >= 12 && hour < 18) {
    return "下午好";
  }
  return "晚上好";
}

export function getSidepanelGreetingLine(): string {
  return `${getSidepanelTimeWord()}，今天有什么可以帮您的吗？`;
}
