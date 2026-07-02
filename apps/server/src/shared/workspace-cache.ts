import { prisma } from "@repo/database";
import { cacheDel, cacheDelPattern, CACHE_KEYS } from "./redis-cache.js";

async function getWorkspaceUserIds(workspaceId: string): Promise<string[]> {
  const [members, workspace] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: { userId: true },
    }),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    }),
  ]);

  const userIds = new Set(members.map((member) => member.userId));
  if (workspace?.ownerId) {
    userIds.add(workspace.ownerId);
  }

  return [...userIds];
}

/** 失效单个用户的空间列表缓存 */
export async function invalidateWsListForUser(userId: string): Promise<void> {
  await cacheDel(CACHE_KEYS.wsList(userId));
}

/** 失效单个用户的文档列表缓存（空间成员变更会影响可见文档） */
export async function invalidateUserDocumentListCache(
  userId: string
): Promise<void> {
  await cacheDelPattern(CACHE_KEYS.docsListPrefix(userId));
  await cacheDel(CACHE_KEYS.docsAll(userId));
}

/** 成员加入/离开/被移除后，刷新该用户的空间与文档缓存 */
export async function invalidateUserMembershipCaches(
  userId: string
): Promise<void> {
  await Promise.all([
    invalidateWsListForUser(userId),
    invalidateUserDocumentListCache(userId),
  ]);
}

/** 失效空间内所有成员（含所有者）的空间列表缓存 */
export async function invalidateWsListForWorkspace(
  workspaceId: string,
  extraUserIds: string[] = []
): Promise<void> {
  const userIds = new Set(await getWorkspaceUserIds(workspaceId));
  for (const userId of extraUserIds) {
    userIds.add(userId);
  }

  if (userIds.size === 0) {
    return;
  }

  await cacheDel(...[...userIds].map((id) => CACHE_KEYS.wsList(id)));
}

/** 删除空间前收集需失效缓存的用户 ID */
export async function collectWorkspaceUserIds(
  workspaceId: string
): Promise<string[]> {
  return getWorkspaceUserIds(workspaceId);
}
