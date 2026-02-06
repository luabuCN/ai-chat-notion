import "server-only";
import { ChatSDKError } from "../errors";
import { prisma } from "../client";
import { generateHashedPassword } from "../password";
import { generateUUID } from "../utils";
import { User } from "./types";
import { createWorkspace, generateWorkspaceSlug } from "./workspace";

export async function getUser(identifier: string): Promise<User[]> {
  try {
    return await prisma.user.findMany({
      where: {
        OR: [{ email: identifier }, { name: identifier }],
      },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user by identifier"
    );
  }
}

export async function createUser(
  email: string,
  password: string,
  name: string
) {
  const hashedPassword = generateHashedPassword(password);
  const avatarUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(
    name
  )}`;

  try {
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        avatarUrl,
      },
    });

    // 自动为新用户创建默认工作区
    const workspace = await createWorkspace({
      name: "我的空间",
      slug: generateWorkspaceSlug(),
      ownerId: user.id,
    });

    // 更新用户的当前工作空间 ID
    await prisma.user.update({
      where: { id: user.id },
      data: { currentWorkspaceId: workspace.id },
    });

    return user;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to create user");
  }
}

export async function updateUserCurrentWorkspace({
  userId,
  workspaceId,
}: {
  userId: string;
  workspaceId: string | null;
}) {
  try {
    return await prisma.user.update({
      where: { id: userId },
      data: { currentWorkspaceId: workspaceId },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update current workspace"
    );
  }
}

export async function getUserCurrentWorkspace({ userId }: { userId: string }) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { currentWorkspaceId: true },
    });

    if (!user?.currentWorkspaceId) {
      return null;
    }

    return await prisma.workspace.findUnique({
      where: { id: user.currentWorkspaceId },
    });
  } catch (_error) {
    return null;
  }
}
