import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { EditorDocument } from "@repo/database";

// Query Keys
export const documentKeys = {
  all: ["editor-documents"] as const,
  lists: () => [...documentKeys.all, "list"] as const,
  list: (parentDocumentId?: string, workspaceId?: string) =>
    [...documentKeys.lists(), { parentDocumentId, workspaceId }] as const,
  details: () => [...documentKeys.all, "detail"] as const,
  detail: (id: string) => [...documentKeys.details(), id] as const,
  updates: () => [...documentKeys.all, "update"] as const,
  trashes: () => [...documentKeys.all, "trash"] as const,
  trash: (workspaceId?: string) =>
    [...documentKeys.trashes(), { workspaceId }] as const,
};

// API Functions
async function fetchDocuments(
  parentDocumentId?: string,
  workspaceId?: string
): Promise<EditorDocument[]> {
  const params = new URLSearchParams();
  if (parentDocumentId) {
    params.append("parentDocumentId", parentDocumentId);
  }
  if (workspaceId) {
    params.append("workspaceId", workspaceId);
  }
  params.append("includeDeleted", "false");

  const response = await fetch(`/api/editor-documents?${params.toString()}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "获取文档列表失败");
  }
  return response.json();
}

async function fetchDocument(documentId: string): Promise<EditorDocument> {
  const response = await fetch(`/api/editor-documents/${documentId}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "获取文档失败");
  }
  return response.json();
}

async function createDocument(arg: {
  title: string;
  parentDocumentId?: string;
  workspaceId?: string;
}): Promise<EditorDocument> {
  const response = await fetch("/api/editor-documents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: arg.title,
      parentDocumentId: arg.parentDocumentId ?? null,
      workspaceId: arg.workspaceId ?? null,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "创建文档失败");
  }

  return response.json();
}

async function updateDocument({
  documentId,
  updates,
}: {
  documentId: string;
  updates: {
    title?: string;
    content?: string;
    icon?: string | null;
    coverImage?: string | null;
    coverImageType?: "color" | "url" | null;
    coverImagePosition?: number | null;
    isPublished?: boolean;
    isFavorite?: boolean;
  };
}): Promise<EditorDocument> {
  const response = await fetch(`/api/editor-documents/${documentId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "更新文档失败");
  }

  return response.json();
}

async function deleteDocument(documentId: string): Promise<void> {
  const response = await fetch(`/api/editor-documents/${documentId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "删除文档失败");
  }
}

async function publishDocument({
  documentId,
  publish,
}: {
  documentId: string;
  publish: boolean;
}): Promise<EditorDocument> {
  const response = await fetch(`/api/editor-documents/${documentId}/publish`, {
    method: publish ? "POST" : "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "发布操作失败");
  }

  return response.json();
}

async function duplicateDocument(documentId: string): Promise<EditorDocument> {
  const response = await fetch(
    `/api/editor-documents/${documentId}/duplicate`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "复制文档失败");
  }

  return response.json();
}

async function moveDocument({
  documentId,
  parentDocumentId,
}: {
  documentId: string;
  parentDocumentId: string | null;
}): Promise<EditorDocument> {
  const response = await fetch(`/api/editor-documents/${documentId}/move`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ parentDocumentId }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "移动文档失败");
  }

  return response.json();
}

// Hooks
export function useSidebarDocuments(
  parentDocumentId?: string,
  workspaceId?: string
) {
  return useQuery({
    queryKey: documentKeys.list(parentDocumentId, workspaceId),
    queryFn: () => fetchDocuments(parentDocumentId, workspaceId),
    enabled: !!workspaceId, // 只有在有 workspaceId 时才获取
  });
}

export function useGetDocument(documentId: string | null | undefined) {
  return useQuery({
    queryKey: documentKeys.detail(documentId ?? ""),
    queryFn: () => fetchDocument(documentId!),
    enabled: !!documentId, // 只有在有 documentId 时才启用
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createDocument,
    onSuccess: async (newDoc) => {
      // 乐观更新：直接将新文档添加到父文档的列表中
      if (newDoc.parentDocumentId) {
        queryClient.setQueryData<EditorDocument[]>(
          documentKeys.list(newDoc.parentDocumentId),
          (oldData) => {
            if (!oldData) return [newDoc];
            // 检查是否已存在，避免重复
            if (oldData.some((doc) => doc.id === newDoc.id)) {
              return oldData;
            }
            return [...oldData, newDoc];
          }
        );
      }

      // 同时使所有列表查询失效（包括带有 workspaceId 的列表）
      await queryClient.invalidateQueries({ queryKey: documentKeys.lists() });

      // 如果创建了子文档，也使父文档的列表失效（作为后备，确保数据同步）
      if (newDoc.parentDocumentId) {
        await queryClient.invalidateQueries({
          queryKey: documentKeys.list(newDoc.parentDocumentId),
        });
      }
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: documentKeys.updates(),
    mutationFn: updateDocument,
    onSuccess: async (updatedDoc, variables) => {
      // 更新单个文档的缓存
      queryClient.setQueryData(
        documentKeys.detail(variables.documentId),
        updatedDoc
      );

      // 如果更新了标题或图标，需要刷新列表
      const needsListRefresh =
        variables.updates.title !== undefined ||
        variables.updates.icon !== undefined;

      if (needsListRefresh) {
        // 使所有列表查询失效
        await queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
      }

      // 发送事件通知其他组件（保持向后兼容）
      window.dispatchEvent(
        new CustomEvent("document-updated", { detail: updatedDoc })
      );
    },
  });
}

export function useArchive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDocument,
    onSuccess: async (_, documentId) => {
      // 删除后刷新所有列表
      await queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
      // 刷新垃圾箱列表
      await queryClient.invalidateQueries({ queryKey: documentKeys.trashes() });
    },
  });
}

export function usePublishDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: publishDocument,
    onSuccess: async (updatedDoc) => {
      // 更新单个文档的缓存
      queryClient.setQueryData(documentKeys.detail(updatedDoc.id), updatedDoc);
      // 刷新列表
      await queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    },
  });
}

export function useDuplicateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: duplicateDocument,
    onSuccess: async (newDoc) => {
      // 刷新所有列表以显示新复制的文档
      await queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
      // 如果复制的是子文档,也刷新父文档的列表
      if (newDoc.parentDocumentId) {
        await queryClient.invalidateQueries({
          queryKey: documentKeys.list(newDoc.parentDocumentId),
        });
      }
    },
  });
}

export function useMoveDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: moveDocument,
    onSuccess: async () => {
      // 移动后刷新所有列表
      await queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    },
  });
}

async function fetchDocumentPath(documentId: string): Promise<string[]> {
  const response = await fetch(`/api/editor-documents/${documentId}/path`);
  if (!response.ok) {
    throw new Error("Failed to fetch document path");
  }
  return response.json();
}

export function useDocumentPath(documentId: string | null | undefined) {
  return useQuery({
    queryKey: [...documentKeys.details(), "path", documentId],
    queryFn: () => fetchDocumentPath(documentId!),
    enabled: !!documentId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Trash Hooks

async function fetchTrashDocuments(
  workspaceId?: string
): Promise<EditorDocument[]> {
  const params = new URLSearchParams();
  params.append("onlyDeleted", "true");
  if (workspaceId) {
    params.append("workspaceId", workspaceId);
  }
  const response = await fetch(`/api/editor-documents?${params.toString()}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to fetch trash documents");
  }
  return response.json();
}

async function restoreDocument(documentId: string): Promise<EditorDocument> {
  const response = await fetch(`/api/editor-documents/${documentId}/restore`, {
    method: "POST",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to restore document");
  }

  return response.json();
}

async function permanentDeleteDocument(documentId: string): Promise<void> {
  const response = await fetch(
    `/api/editor-documents/${documentId}?permanent=true`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.message || "Failed to permanently delete document"
    );
  }
}

export function useTrashDocuments(workspaceId?: string) {
  return useQuery({
    queryKey: documentKeys.trash(workspaceId),
    queryFn: () => fetchTrashDocuments(workspaceId),
  });
}

export function useRestoreDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: restoreDocument,
    onSuccess: async (updatedDoc) => {
      // Refresh trash list
      await queryClient.invalidateQueries({ queryKey: documentKeys.trashes() });
      // Refresh main lists as document reappears
      await queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
      // Refresh the specific document details
      await queryClient.invalidateQueries({
        queryKey: documentKeys.detail(updatedDoc.id),
      });
    },
  });
}

export function usePermanentDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: permanentDeleteDocument,
    onSuccess: async () => {
      // Refresh trash list
      await queryClient.invalidateQueries({ queryKey: documentKeys.trashes() });
    },
  });
}
