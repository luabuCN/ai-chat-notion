"use client";

import { useMemo } from "react";
import {
  checkDocumentPermission,
  type DocumentPermissionParams,
  type DocumentPermissionResult,
} from "@/lib/document-permission";

/**
 * 文档权限 Hook（客户端）
 *
 * 使用统一的权限检查逻辑，遵循漏斗模型
 *
 * @example
 * ```tsx
 * const { canEdit, canDelete, isOwner } = useDocumentPermission({
 *   document,
 *   currentUserId,
 *   currentUserEmail,
 *   workspaceOwnerId,
 *   workspaceMemberRole,
 *   workspaceMemberPermission,
 *   documentCollaborator,
 * });
 * ```
 */
export function useDocumentPermission(
  params: Partial<DocumentPermissionParams>
): DocumentPermissionResult {
  return useMemo(() => {
    // 如果缺少必要参数，返回无权限
    if (!params.documentId || !params.documentUserId) {
      return {
        access: "none",
        canView: false,
        canEdit: false,
        canDelete: false,
        canShare: false,
        canPublish: false,
        isOwner: false,
        isCollaborator: false,
        reason: "Missing required parameters",
      };
    }

    return checkDocumentPermission({
      documentId: params.documentId,
      documentUserId: params.documentUserId,
      documentWorkspaceId: params.documentWorkspaceId ?? null,
      documentIsPublished: params.documentIsPublished ?? false,
      documentDeletedAt: params.documentDeletedAt ?? null,
      currentUserId: params.currentUserId,
      currentUserEmail: params.currentUserEmail,
      workspaceOwnerId: params.workspaceOwnerId,
      workspaceMemberRole: params.workspaceMemberRole,
      workspaceMemberPermission: params.workspaceMemberPermission,
      documentCollaboratorPermission: params.documentCollaboratorPermission,
      documentCollaboratorStatus: params.documentCollaboratorStatus,
    });
  }, [
    params.documentId,
    params.documentUserId,
    params.documentWorkspaceId,
    params.documentIsPublished,
    params.documentDeletedAt,
    params.currentUserId,
    params.currentUserEmail,
    params.workspaceOwnerId,
    params.workspaceMemberRole,
    params.workspaceMemberPermission,
    params.documentCollaboratorPermission,
    params.documentCollaboratorStatus,
  ]);
}
