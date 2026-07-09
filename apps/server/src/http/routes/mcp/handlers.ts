import { Hono } from "hono";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getBearerToken } from "../../../shared/auth.js";
import type { AuthSession } from "../../../shared/auth.js";
import { serverConfig } from "../../../shared/config.js";
import { verifyWorkspaceAccess } from "../../../shared/workspace-access.js";
import { textToYjsState } from "../../../shared/text-to-yjs.js";
import { cacheDel, CACHE_KEYS } from "../../../shared/redis-cache.js";
import {
  getMcpTokenByToken,
  createEditorDocument,
  getEditorDocumentById,
  getEditorDocumentsByUserId,
  updateEditorDocument,
  getWorkspaceBySlug,
  getWorkspacesByUserId,
} from "@repo/database";

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

/** 生成文档在前端的访问 URL */
function buildDocumentUrl(documentId: string): string {
  return `${serverConfig.webOrigin}/editor/${documentId}`;
}

/** 工具结果辅助函数 */
function textResult(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  };
}

function errorResult(message: string) {
  return textResult(`Error: ${message}`);
}

/**
 * 获取用户的默认空间（第一个自有空间，否则第一个加入的空间）。
 */
async function getDefaultWorkspaceId(userId: string): Promise<string | null> {
  const workspaces = await getWorkspacesByUserId({ userId });
  if (workspaces.length === 0) return null;
  const owned = workspaces.find((w) => w.ownerId === userId);
  return (owned ?? workspaces[0]).id;
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

  // ─── Tool 1: list_workspaces ──────────────────────────────────────
  server.tool(
    "list_workspaces",
    "获取当前用户的所有空间列表，包括自有的和加入的空间。返回空间 ID、名称、slug 和角色信息。",
    {},
    async () => {
      try {
        const workspaces = await getWorkspacesByUserId({
          userId: session.user.id,
        });

        return textResult(
          JSON.stringify(
            workspaces.map((ws) => ({
              id: ws.id,
              name: ws.name,
              slug: ws.slug,
              role: ws.ownerId === session.user.id ? "owner" : "member",
              memberCount: ws._count?.members ?? 0,
            })),
          ),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "获取空间列表失败";
        return errorResult(message);
      }
    },
  );

  // ─── Tool 2: create_document ──────────────────────────────────────
  server.tool(
    "create_document",
    "创建一个新文档。传入标题和内容（Markdown 格式），可选传入目标空间 slug。不传空间则创建到默认空间。",
    {
      title: z.string().describe("文档标题"),
      content: z
        .string()
        .optional()
        .describe("文档内容，支持 Markdown 格式（标题、列表、代码块等）"),
      workspaceSlug: z
        .string()
        .optional()
        .describe("目标空间 slug（可选，不传则创建到默认空间）"),
    },
    async ({ title, content, workspaceSlug }) => {
      try {
        let workspaceId: string | null = null;

        if (workspaceSlug) {
          const workspace = await getWorkspaceBySlug({ slug: workspaceSlug });
          if (!workspace) {
            return errorResult("指定的空间不存在");
          }
          const hasAccess = await verifyWorkspaceAccess(
            workspace.id,
            session,
          );
          if (!hasAccess) {
            return errorResult("无权访问此空间");
          }
          workspaceId = workspace.id;
        } else {
          // 不传空间时，使用用户的默认空间
          const defaultId = await getDefaultWorkspaceId(session.user.id);
          if (defaultId) {
            workspaceId = defaultId;
          }
        }

        // 将文本内容转换为 Tiptap JSON + Yjs 二进制状态
        const { content: tiptapJson, yjsState } = textToYjsState(
          content ?? "",
        );

        const document = await createEditorDocument({
          title,
          content: tiptapJson,
          yjsState,
          userId: session.user.id,
          workspaceId,
        });

        return textResult(
          JSON.stringify({
            id: document.id,
            title: document.title,
            workspaceId: document.workspaceId,
            url: buildDocumentUrl(document.id),
          }),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "创建文档失败";
        return errorResult(message);
      }
    },
  );

  // ─── Tool 3: get_document ─────────────────────────────────────────
  server.tool(
    "get_document",
    "获取指定文档的内容。需要传入文档 ID。返回标题、内容、所属空间等信息。",
    {
      documentId: z
        .string()
        .uuid()
        .describe("要查看的文档 ID（UUID 格式）"),
    },
    async ({ documentId }) => {
      try {
        const document = await getEditorDocumentById({ id: documentId });

        if (document.userId !== session.user.id) {
          return errorResult("无权访问此文档");
        }

        return textResult(
          JSON.stringify({
            id: document.id,
            title: document.title,
            icon: document.icon,
            content: document.content || "(空文档)",
            workspaceId: document.workspaceId,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
          }),
        );
      } catch {
        return errorResult("文档不存在");
      }
    },
  );

  // ─── Tool 4: update_document ──────────────────────────────────────
  server.tool(
    "update_document",
    "修改指定文档的标题和/或内容。需要传入文档 ID，至少提供 title 或 content 之一。内容支持 Markdown 格式。",
    {
      documentId: z
        .string()
        .uuid()
        .describe("要修改的文档 ID（UUID 格式）"),
      title: z.string().optional().describe("新标题（可选）"),
      content: z
        .string()
        .optional()
        .describe("新内容，支持 Markdown 格式（可选）"),
    },
    async ({ documentId, title, content }) => {
      try {
        if (!title && content === undefined) {
          return errorResult("至少需要提供 title 或 content");
        }

        const document = await getEditorDocumentById({ id: documentId });

        if (document.userId !== session.user.id) {
          return errorResult("无权修改此文档");
        }

        // 如果提供了 content，转换为 Tiptap JSON + Yjs 状态
        let tiptapContent: string | undefined;
        let yjsState: Uint8Array<ArrayBuffer> | undefined;

        if (content !== undefined) {
          const result = textToYjsState(content);
          tiptapContent = result.content;
          yjsState = result.yjsState;
        }

        const updated = await updateEditorDocument({
          id: documentId,
          title,
          content: tiptapContent,
          yjsState,
          lastEditedBy: session.user.id,
          lastEditedByName: session.user.name || "Unknown",
        });

        // 清除 Redis 缓存中的 yjsState，使下次加载从 DB 读取新内容
        if (yjsState) {
          await cacheDel(CACHE_KEYS.yjsState(documentId));
        }

        return textResult(
          JSON.stringify({
            id: updated.id,
            title: updated.title,
            content: updated.content,
            updatedAt: updated.updatedAt,
          }),
        );
      } catch {
        return errorResult("文档不存在");
      }
    },
  );

  // ─── Tool 5: list_documents ───────────────────────────────────────
  server.tool(
    "list_documents",
    "列出用户的文档。可选传入空间 slug 以过滤特定空间的文档。返回文档 ID、标题、所属空间等信息。",
    {
      workspaceSlug: z
        .string()
        .optional()
        .describe("空间 slug（可选，不传则列出所有空间的文档）"),
    },
    async ({ workspaceSlug }) => {
      try {
        let workspaceId: string | undefined;

        if (workspaceSlug) {
          const workspace = await getWorkspaceBySlug({ slug: workspaceSlug });
          if (!workspace) {
            return errorResult("指定的空间不存在");
          }
          const hasAccess = await verifyWorkspaceAccess(
            workspace.id,
            session,
          );
          if (!hasAccess) {
            return errorResult("无权访问此空间");
          }
          workspaceId = workspace.id;
        }

        const documents = await getEditorDocumentsByUserId({
          userId: session.user.id,
          workspaceId,
          parentDocumentId: null,
          includeDeleted: false,
          onlyDeleted: false,
        });

        // 安全过滤：仅返回属于当前用户的文档
        const userDocs = documents.filter(
          (doc) => doc.userId === session.user.id,
        );

        return textResult(
          JSON.stringify(
            userDocs.map((doc) => ({
              id: doc.id,
              title: doc.title,
              icon: doc.icon,
              workspaceId: doc.workspaceId,
              createdAt: doc.createdAt,
              updatedAt: doc.updatedAt,
            })),
          ),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "获取文档列表失败";
        return errorResult(message);
      }
    },
  );

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

