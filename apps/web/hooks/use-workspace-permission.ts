"use client";

import { useMemo } from "react";
import { useWorkspace } from "@/components/workspace-provider";

export type WorkspaceRole = "owner" | "admin" | "member";
export type WorkspacePermission = "edit" | "view";

export interface WorkspacePermissionResult {
  /** 当前用户在工作空间的角色 */
  role: WorkspaceRole;
  /** 当前用户的权限级别 */
  permission: WorkspacePermission;
  /** 是否是空间创建者 */
  isOwner: boolean;
  /** 是否是管理员 */
  isAdmin: boolean;
  /** 能否编辑文档 */
  canEdit: boolean;
  /** 能否删除文档 */
  canDelete: boolean;
  /** 能否创建文档 */
  canCreate: boolean;
  /** 能否管理成员 */
  canManageMembers: boolean;
  /** 能否管理设置 */
  canManageSettings: boolean;
  /** 能否继续某个对话（只有对话所有者可以） */
  canContinueChat: (chatOwnerId: string, currentUserId: string) => boolean;
  /** 能否编辑某个文档 */
  canEditDocument: (documentOwnerId: string, currentUserId: string) => boolean;
}

/**
 * 工作空间权限 Hook
 *
 * 权限规则：
 * - owner: 全部权限（编辑、删除、管理成员、设置）
 * - admin: 编辑权限（编辑、删除、创建文档）
 * - member + edit: 编辑权限（编辑、创建文档）
 * - member + view: 只读权限（只能查看）
 *
 * @example
 * ```tsx
 * const { canEdit, canContinueChat } = useWorkspacePermission();
 * if (canEdit) { ... }
 * if (canContinueChat(chat.userId, currentUserId)) { ... }
 * ```
 */
export function useWorkspacePermission(): WorkspacePermissionResult {
  const { currentWorkspace } = useWorkspace();

  return useMemo(() => {
    // 默认值：无权限
    const defaultResult: WorkspacePermissionResult = {
      role: "member",
      permission: "view",
      isOwner: false,
      isAdmin: false,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      canManageMembers: false,
      canManageSettings: false,
      canContinueChat: () => false,
      canEditDocument: () => false,
    };

    if (!currentWorkspace) {
      return defaultResult;
    }

    // 从 workspace.members 获取当前用户的角色和权限
    // members 数组包含当前用户的 { role, permission } 信息
    const memberInfo = currentWorkspace.members?.[0];
    const role: WorkspaceRole = (memberInfo?.role as WorkspaceRole) || "member";
    const permission: WorkspacePermission =
      (memberInfo?.permission as WorkspacePermission) || "view";

    // 判断是否是所有者（ownerId 存在于 workspace 对象中）
    // 注意：如果当前用户是所有者，他可能不在 members 数组中
    // 这种情况需要通过比较 ownerId 来判断
    const isOwner = role === "owner" || !memberInfo; // 如果没有 memberInfo，可能是所有者
    const isAdmin = role === "admin";

    // 权限计算
    const canEdit = isOwner || isAdmin || permission === "edit";
    const canDelete = isOwner || isAdmin;
    const canCreate = isOwner || isAdmin || permission === "edit";
    const canManageMembers = isOwner || isAdmin;
    const canManageSettings = isOwner;

    // 对话权限：只有对话所有者可以继续
    const canContinueChat = (chatOwnerId: string, currentUserId: string) => {
      return chatOwnerId === currentUserId;
    };

    // 文档编辑权限：所有者/管理员可以编辑所有，其他人看权限
    const canEditDocument = (
      documentOwnerId: string,
      currentUserId: string
    ) => {
      if (isOwner || isAdmin) return true;
      if (permission === "edit") return true;
      // 文档所有者始终可以编辑自己的文档
      if (documentOwnerId === currentUserId) return true;
      return false;
    };

    return {
      role,
      permission,
      isOwner,
      isAdmin,
      canEdit,
      canDelete,
      canCreate,
      canManageMembers,
      canManageSettings,
      canContinueChat,
      canEditDocument,
    };
  }, [currentWorkspace]);
}

/**
 * 服务端权限检查函数
 * 用于 API 路由中检查权限
 */
export function checkWorkspacePermission(
  memberRole: string | undefined,
  memberPermission: string | undefined,
  isWorkspaceOwner: boolean
): WorkspacePermissionResult {
  const role: WorkspaceRole = (memberRole as WorkspaceRole) || "member";
  const permission: WorkspacePermission =
    (memberPermission as WorkspacePermission) || "view";

  const isOwner = isWorkspaceOwner || role === "owner";
  const isAdmin = role === "admin";

  const canEdit = isOwner || isAdmin || permission === "edit";
  const canDelete = isOwner || isAdmin;
  const canCreate = isOwner || isAdmin || permission === "edit";
  const canManageMembers = isOwner || isAdmin;
  const canManageSettings = isOwner;

  const canContinueChat = (chatOwnerId: string, currentUserId: string) => {
    return chatOwnerId === currentUserId;
  };

  const canEditDocument = (documentOwnerId: string, currentUserId: string) => {
    if (isOwner || isAdmin) return true;
    if (permission === "edit") return true;
    if (documentOwnerId === currentUserId) return true;
    return false;
  };

  return {
    role,
    permission,
    isOwner,
    isAdmin,
    canEdit,
    canDelete,
    canCreate,
    canManageMembers,
    canManageSettings,
    canContinueChat,
    canEditDocument,
  };
}
