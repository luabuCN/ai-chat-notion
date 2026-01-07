import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

// 直接创建 Prisma 客户端，避免导入 @repo/database 的 server-only 依赖
const prisma = new PrismaClient();

export interface TokenPayload {
  userId: string;
  email?: string;
  name?: string;
  iat?: number;
  exp?: number;
}

export type AccessLevel = "owner" | "edit" | "view" | "none";

export interface DocumentAccessResult {
  access: AccessLevel;
  document: {
    id: string;
    title: string;
    userId: string;
    workspaceId: string | null;
    isPublished: boolean;
  };
}

/**
 * 验证 JWT Token
 */
export async function verifyToken(
  token: string | null | undefined
): Promise<TokenPayload | null> {
  if (!token) {
    return null;
  }

  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    console.error(
      "[Auth] Missing AUTH_SECRET or JWT_SECRET environment variable"
    );
    return null;
  }

  try {
    const payload = jwt.verify(token, secret) as TokenPayload;
    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.warn("[Auth] Token expired");
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.warn("[Auth] Invalid token:", (error as Error).message);
    } else {
      console.error("[Auth] Token verification error:", error);
    }
    return null;
  }
}

/**
 * 验证用户对文档的访问权限
 */
export async function verifyDocumentAccess(
  documentId: string,
  userId?: string,
  userEmail?: string
): Promise<DocumentAccessResult> {
  const document = await prisma.editorDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      title: true,
      userId: true,
      workspaceId: true,
      isPublished: true,
      deletedAt: true,
    },
  });

  if (!document) {
    throw new Error(`Document ${documentId} not found`);
  }

  // 已删除的文档不允许协同编辑
  if (document.deletedAt) {
    return { access: "none", document };
  }

  if (!userId) {
    // 未登录用户：只能访问已发布的文档（只读）
    if (document.isPublished) {
      return { access: "view", document };
    }
    return { access: "none", document };
  }

  // 1. 文档所有者 - 完全权限
  if (document.userId === userId) {
    return { access: "owner", document };
  }

  // 2. 工作空间权限检查
  if (document.workspaceId) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: document.workspaceId },
      select: { ownerId: true },
    });

    // 空间所有者有完全权限
    if (workspace?.ownerId === userId) {
      return { access: "owner", document };
    }

    // 检查空间成员权限
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: document.workspaceId,
          userId,
        },
      },
      select: {
        role: true,
        permission: true,
      },
    });

    if (member) {
      // 管理员有编辑权限
      if (member.role === "admin") {
        return { access: "edit", document };
      }

      // 普通成员根据 permission 字段判断
      if (member.permission === "edit") {
        return { access: "edit", document };
      }

      return { access: "view", document };
    }
  }

  // 3. 文档协作者权限检查（访客协作者）
  if (userEmail) {
    const collaborator = await prisma.documentCollaborator.findUnique({
      where: {
        documentId_email: {
          documentId,
          email: userEmail,
        },
      },
      select: {
        permission: true,
        status: true,
      },
    });

    if (collaborator && collaborator.status === "accepted") {
      if (collaborator.permission === "edit") {
        return { access: "edit", document };
      }
      return { access: "view", document };
    }
  }

  // 4. 已发布文档 - 只读访问
  if (document.isPublished) {
    return { access: "view", document };
  }

  return { access: "none", document };
}
