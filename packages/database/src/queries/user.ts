import "server-only";
import { ChatSDKError } from "../errors";
import { prisma } from "../client";
import { generateHashedPassword } from "../password";
import { generateUUID } from "../utils";
import { User } from "./types";

export async function getUser(email: string): Promise<User[]> {
  try {
    return await prisma.user.findMany({
      where: { email },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user by email"
    );
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await prisma.user.create({
      data: { email, password: hashedPassword },
    });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to create user");
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    return [
      await prisma.user.create({
        data: { email, password },
        select: { id: true, email: true },
      }),
    ];
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create guest user"
    );
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
