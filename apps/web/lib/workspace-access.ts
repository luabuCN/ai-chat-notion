import { auth } from "@/app/(auth)/auth";
import { getWorkspaceBySlug, hasWorkspaceAccess } from "@repo/database";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type WorkspaceAccessResult = {
  workspaceId: string;
  workspaceSlug: string;
  userId: string;
};

/**
 * 验证当前用户是否有权限访问指定的工作空间
 * 如果没有权限，会重定向到首页
 * 用于服务端组件中的权限检查
 */
export async function requireWorkspaceAccess(
  slug: string
): Promise<WorkspaceAccessResult | null> {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const workspace = await getWorkspaceBySlug({ slug });

  if (!workspace) {
    // 工作空间不存在
    redirect("/");
  }

  const hasAccess = await hasWorkspaceAccess({
    workspaceId: workspace.id,
    userId: session.user.id,
  });

  if (!hasAccess) {
    // 无权限访问此工作空间
    redirect("/");
  }

  return {
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    userId: session.user.id,
  };
}

/**
 * 从请求头中获取工作空间 slug（由 middleware 注入）
 */
export async function getWorkspaceSlugFromHeader(): Promise<string | null> {
  const headersList = await headers();
  return headersList.get("x-workspace-slug");
}

/**
 * 验证 API 请求是否有权限访问指定的工作空间
 * 返回 null 表示无权限或工作空间不存在
 */
export async function verifyWorkspaceAccess(
  workspaceId: string
): Promise<boolean> {
  const session = await auth();

  if (!session?.user) {
    return false;
  }

  return await hasWorkspaceAccess({
    workspaceId,
    userId: session.user.id,
  });
}
