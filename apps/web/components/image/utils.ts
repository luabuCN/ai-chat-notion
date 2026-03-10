export function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function getStatusLabel(status: string) {
  if (status === "SUCCEED") return "已完成";
  if (status === "FAILED") return "失败";
  if (status === "PROCESSING") return "生成中";
  return "排队中";
}
