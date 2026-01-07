/**
 * 用户协同编辑相关工具函数
 */

// 预定义的协同编辑颜色
const COLLABORATION_COLORS = [
  "#F44336", // 红色
  "#E91E63", // 粉红
  "#9C27B0", // 紫色
  "#673AB7", // 深紫
  "#3F51B5", // 靛蓝
  "#2196F3", // 蓝色
  "#03A9F4", // 浅蓝
  "#00BCD4", // 青色
  "#009688", // 蓝绿
  "#4CAF50", // 绿色
  "#8BC34A", // 浅绿
  "#CDDC39", // 黄绿
  "#FFC107", // 琥珀
  "#FF9800", // 橙色
  "#FF5722", // 深橙
  "#795548", // 棕色
];

/**
 * 根据用户 ID 生成一致的颜色
 * 同一用户在不同会话中始终使用相同颜色
 */
export function generateUserColor(userId: string): string {
  // 简单的哈希函数
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // 使用哈希值选择颜色
  const index = Math.abs(hash) % COLLABORATION_COLORS.length;
  return COLLABORATION_COLORS[index];
}

/**
 * 生成用户头像占位符（首字母）
 */
export function generateUserInitials(name: string): string {
  if (!name) return "?";

  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return (parts[0].charAt(0) + parts.at(-1)?.charAt(0)).toUpperCase();
}

