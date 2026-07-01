import jwt from "jsonwebtoken";
import { prisma } from "@repo/database";
import {
  checkDocumentPermission,
  type DocumentPermissionResult,
} from "../shared/permissions.js";

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
    isPubliclyEditable: boolean;
  };
}

// ─── 权限缓存（onChange/store 高频调用时避免重复 DB 查询） ─────────────────
const PERMISSION_CACHE_TTL = 30_000; // 30 秒
const permissionCache = new Map<string, { access: AccessLevel; ts: number }>();

function permissionCacheKey(docId: string, userId?: string, email?: string): string {
  return `${docId}:${userId ?? ""}:${email ?? ""}`;
}

/** 查询缓存的权限（命中返回 access，未命中返回 null） */
export function getCachedAccess(
  docId: string,
  userId?: string,
  email?: string
): AccessLevel | null {
  const key = permissionCacheKey(docId, userId, email);
  const entry = permissionCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > PERMISSION_CACHE_TTL) {
    permissionCache.delete(key);
    return null;
  }
  return entry.access;
}

/** 写入权限缓存 */
export function setCachedAccess(
  docId: string,
  userId: string | undefined,
  email: string | undefined,
  access: AccessLevel
): void {
  const key = permissionCacheKey(docId, userId, email);
  permissionCache.set(key, { access, ts: Date.now() });
  // 惰性清理：超过 500 条时移除过期项
  if (permissionCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of permissionCache) {
      if (now - v.ts > PERMISSION_CACHE_TTL * 2) {
        permissionCache.delete(k);
      }
    }
  }
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
      isPubliclyEditable: true,
      deletedAt: true,
    },
  });

  if (!document) {
    throw new Error(`Document ${documentId} not found`);
  }

  // 并行查询：工作空间（owner + member）与文档协作者互相独立，可同时执行
  const workspacePromise =
    document.workspaceId && userId
      ? Promise.all([
          prisma.workspace.findUnique({
            where: { id: document.workspaceId },
            select: { ownerId: true },
          }),
          prisma.workspaceMember.findUnique({
            where: {
              workspaceId_userId: {
                workspaceId: document.workspaceId,
                userId,
              },
            },
            select: { role: true, permission: true },
          }),
        ])
      : null;

  const collaboratorPromise = userEmail
    ? prisma.documentCollaborator.findUnique({
        where: {
          documentId_email: { documentId, email: userEmail },
        },
        select: { permission: true, status: true },
      })
    : null;

  const [workspaceData, collaboratorData] = await Promise.all([
    workspacePromise,
    collaboratorPromise,
  ]);

  let workspaceOwnerId: string | undefined;
  let workspaceMemberRole: string | undefined;
  let workspaceMemberPermission: string | undefined;

  if (workspaceData) {
    const [workspace, member] = workspaceData;
    workspaceOwnerId = workspace?.ownerId;
    if (member) {
      workspaceMemberRole = member.role;
      workspaceMemberPermission = member.permission;
    }
  }

  let documentCollaboratorPermission: string | undefined;
  let documentCollaboratorStatus: string | undefined;

  if (collaboratorData) {
    documentCollaboratorPermission = collaboratorData.permission;
    documentCollaboratorStatus = collaboratorData.status;
  }

  // 使用统一的权限检查逻辑
  const permissionResult: DocumentPermissionResult = checkDocumentPermission({
    documentId: document.id,
    documentUserId: document.userId,
    documentWorkspaceId: document.workspaceId,
    documentIsPublished: document.isPublished,
    documentIsPubliclyEditable: document.isPubliclyEditable,
    documentDeletedAt: document.deletedAt,
    currentUserId: userId,
    currentUserEmail: userEmail,
    workspaceOwnerId,
    workspaceMemberRole,
    workspaceMemberPermission,
    documentCollaboratorPermission,
    documentCollaboratorStatus,
  });
  return { access: permissionResult.access, document };
}
