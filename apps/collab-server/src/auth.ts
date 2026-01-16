import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import {
  checkDocumentPermission,
  type DocumentPermissionResult,
} from "./document-permission.js";

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

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    console.error("[Auth] Missing AUTH_SECRET environment variable");
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
 * 验证用户对文档的访问权限（协作服务器）
 *
 * 使用统一的漏斗模型权限检查逻辑
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

  // 获取工作空间信息
  let workspaceOwnerId: string | undefined;
  let workspaceMemberRole: string | undefined;
  let workspaceMemberPermission: string | undefined;

  if (document.workspaceId && userId) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: document.workspaceId },
      select: { ownerId: true },
    });
    workspaceOwnerId = workspace?.ownerId;

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
      workspaceMemberRole = member.role;
      workspaceMemberPermission = member.permission;
    }
  }

  // 获取文档协作者信息
  let documentCollaboratorPermission: string | undefined;
  let documentCollaboratorStatus: string | undefined;

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

    if (collaborator) {
      documentCollaboratorPermission = collaborator.permission;
      documentCollaboratorStatus = collaborator.status;
    }
  }

  // 使用统一的权限检查逻辑
  const permissionResult: DocumentPermissionResult = checkDocumentPermission({
    documentId: document.id,
    documentUserId: document.userId,
    documentWorkspaceId: document.workspaceId,
    documentIsPublished: document.isPublished,
    documentDeletedAt: document.deletedAt,
    currentUserId: userId,
    currentUserEmail: userEmail,
    workspaceOwnerId,
    workspaceMemberRole,
    workspaceMemberPermission,
    documentCollaboratorPermission,
    documentCollaboratorStatus,
  });

  console.log("[Collab Auth] Permission check result:", {
    documentId,
    userId,
    access: permissionResult.access,
    reason: permissionResult.reason,
  });

  return { access: permissionResult.access, document };
}
