import { Hono } from "hono";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getBearerToken } from "../../../shared/auth.js";
import type { AuthSession } from "../../../shared/auth.js";
import { getMcpTokenByToken } from "@repo/database";

// Tool 注册函数
import type { ToolContext } from "./tools/types.js";
import { registerListWorkspacesTool } from "./tools/list-workspaces.js";
import { registerCreateDocumentTool } from "./tools/create-document.js";
import { registerGetDocumentTool } from "./tools/get-document.js";
import { registerUpdateDocumentTool } from "./tools/update-document.js";
import { registerListDocumentsTool } from "./tools/list-documents.js";
import { registerDeleteDocumentTool } from "./tools/delete-document.js";

/**
 * 从 MCP Bearer token 认证用户。
 * 与 NextAuth session 不同，MCP 使用长期 token 查表认证。
 */
async function authenticateMcpToken(
  request: Request,
): Promise<AuthSession | null> {
  const bearerToken = getBearerToken(request);
  if (!bearerToken) {
    return null;
  }

  const tokenRecord = await getMcpTokenByToken(bearerToken);
  if (!tokenRecord) {
    return null;
  }

  return {
    user: {
      id: tokenRecord.userId,
      email: "",
      name: "MCP User",
      type: "regular",
    },
  };
}

/**
 * 创建并配置一个 MCP Server 实例，注册文档管理工具。
 * 每次请求创建新实例（stateless 模式），以捕获 per-request 的用户 session。
 */
function createMcpServerInstance(session: AuthSession): McpServer {
  const server = new McpServer(
    { name: "zhizuo-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  const ctx: ToolContext = { server, session };

  // 注册所有工具
  registerListWorkspacesTool(ctx);
  registerCreateDocumentTool(ctx);
  registerGetDocumentTool(ctx);
  registerUpdateDocumentTool(ctx);
  registerListDocumentsTool(ctx);
  registerDeleteDocumentTool(ctx);

  return server;
}

// ─── Hono Route ───────────────────────────────────────────────────────

export const mcpRoutes = new Hono();

mcpRoutes.all("/", async (c) => {
  // 1. 认证 MCP Bearer token
  const session = await authenticateMcpToken(c.req.raw);
  if (!session) {
    return c.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: "Unauthorized: Invalid or missing MCP token",
        },
        id: null,
      },
      401,
    );
  }

  // 2. 创建 stateless transport + MCP server（每请求新实例）
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  const server = createMcpServerInstance(session);

  try {
    // 3. 连接 server 到 transport（设置 MCP 协议处理器）
    await server.connect(transport);

    // 4. 处理 HTTP 请求
    const response = await transport.handleRequest(c.req.raw);

    // 5. 关闭 transport（stateless 模式，请求处理完即关闭）
    await transport.close();

    return response;
  } catch (error) {
    console.error("[MCP] Error handling request:", error);
    await transport.close();
    return c.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal error",
        },
        id: null,
      },
      500,
    );
  }
});
