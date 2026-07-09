import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthSession } from "../../../../shared/auth.js";
import { serverConfig } from "../../../../shared/config.js";
import { getWorkspacesByUserId } from "@repo/database";

/** 每个 tool 注册函数接收的上下文 */
export interface ToolContext {
  server: McpServer;
  session: AuthSession;
}

/** 工具结果辅助函数 */
export function textResult(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  };
}

export function errorResult(message: string) {
  return textResult(`Error: ${message}`);
}

/** 生成文档在前端的访问 URL */
export function buildDocumentUrl(documentId: string): string {
  return `${serverConfig.webOrigin}/editor/${documentId}`;
}

/**
 * 获取用户的默认空间（第一个自有空间，否则第一个加入的空间）。
 */
export async function getDefaultWorkspaceId(
  userId: string,
): Promise<string | null> {
  const workspaces = await getWorkspacesByUserId({ userId });
  if (workspaces.length === 0) return null;
  const owned = workspaces.find((w) => w.ownerId === userId);
  return (owned ?? workspaces[0]).id;
}
