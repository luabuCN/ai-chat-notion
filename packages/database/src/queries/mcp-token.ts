import crypto from "node:crypto";
import { prisma } from "../client.js";

/**
 * 计算 Token 的 SHA-256 哈希。
 * 数据库仅存储哈希值，明文仅在生成时返回一次。
 */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * 通过 token 明文查询 MCP Token（MCP 端点认证用）。
 * 内部对输入 token 计算哈希后匹配，返回包含 userId 的记录。
 */
export async function getMcpTokenByToken(token: string) {
  return prisma.mcpToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * 获取用户的 MCP Token 信息（前端展示用）。
 * 不返回 tokenHash，仅返回存在性和时间戳。
 */
export async function getMcpTokenByUserId(userId: string) {
  return prisma.mcpToken.findUnique({
    where: { userId },
    select: {
      id: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * 创建或更新 MCP Token（单 token 策略）。
 * 使用 upsert 保证原子性，避免竞态条件。
 */
export async function createMcpToken(userId: string, token: string) {
  return prisma.mcpToken.upsert({
    where: { userId },
    create: { userId, tokenHash: hashToken(token) },
    update: { tokenHash: hashToken(token) },
    select: {
      id: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * 删除用户的 MCP Token（重新生成 / 吊销用）。
 */
export async function deleteMcpTokenByUserId(userId: string) {
  return prisma.mcpToken.deleteMany({ where: { userId } });
}
