import { getWorkspacesByUserId } from "@repo/database";
import type { ToolContext } from "./types.js";
import { textResult, errorResult } from "./types.js";

/** 注册 list_workspaces 工具 */
export function registerListWorkspacesTool(ctx: ToolContext) {
  ctx.server.tool(
    "list_workspaces",
    "获取当前用户的所有空间列表，包括自有的和加入的空间。返回空间 ID、名称、slug 和角色信息。",
    {},
    async () => {
      try {
        const workspaces = await getWorkspacesByUserId({
          userId: ctx.session.user.id,
        });

        return textResult(
          JSON.stringify(
            workspaces.map((ws) => ({
              id: ws.id,
              name: ws.name,
              slug: ws.slug,
              role: ws.ownerId === ctx.session.user.id ? "owner" : "member",
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
}
