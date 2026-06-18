type DocumentWithAccess = {
  accessLevel?: string;
  canManage?: boolean;
  deletedAt?: Date | string | null;
};

export interface DocumentUiPermissions {
  isReadOnly: boolean;
  readonly: boolean;
  isOwner: boolean;
  canManage: boolean;
  isDeleted: boolean;
  /** 图标、标题、封面等元数据 — 仅文档所有者 */
  canEditMetadata: boolean;
  /** 分享 — 文档所有者或空间管理员 */
  canShare: boolean;
  /** 发布 — 非只读且可管理（与 EditorHeader 一致） */
  canPublish: boolean;
}

export function getDocumentUiPermissions(
  document: DocumentWithAccess | null | undefined
): DocumentUiPermissions {
  const isDeleted = Boolean(document?.deletedAt);
  const isReadOnly = document?.accessLevel === "view" || isDeleted;
  const isOwner = document?.accessLevel === "owner";
  const canManage = document?.canManage ?? isOwner;

  return {
    isReadOnly,
    readonly: isReadOnly,
    isOwner,
    canManage,
    isDeleted,
    canEditMetadata: isOwner && !isReadOnly && !isDeleted,
    canShare: !isDeleted && canManage,
    canPublish: !isReadOnly && canManage,
  };
}
