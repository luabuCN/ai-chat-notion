import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { EditorDocument } from "@repo/database";

// Query Keys
export const documentKeys = {
  all: ["editor-documents"] as const,
  lists: () => [...documentKeys.all, "list"] as const,
  list: (parentDocumentId?: string) =>
    [...documentKeys.lists(), { parentDocumentId }] as const,
  details: () => [...documentKeys.all, "detail"] as const,
  detail: (id: string) => [...documentKeys.details(), id] as const,
};

// API Functions
async function fetchDocuments(parentDocumentId?: string): Promise<EditorDocument[]> {
  const params = new URLSearchParams();
  if (parentDocumentId) {
    params.append("parentDocumentId", parentDocumentId);
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

async function createDocument(
  arg: { title: string; parentDocumentId?: string }
): Promise<EditorDocument> {
  const response = await fetch("/api/editor-documents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: arg.title,
      parentDocumentId: arg.parentDocumentId ?? null,
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
    isPublished?: boolean;
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
  const response = await fetch(
    `/api/editor-documents/${documentId}/publish`,
    {
      method: publish ? "POST" : "DELETE",
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "发布操作失败");
  }

  return response.json();
}

// Hooks
export function useSidebarDocuments(parentDocumentId?: string) {
  return useQuery({
    queryKey: documentKeys.list(parentDocumentId),
    queryFn: () => fetchDocuments(parentDocumentId),
    enabled: true, // 总是启用，首次加载就会调用
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
    onSuccess: (newDoc) => {
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

      // 同时使根列表失效（如果有的话）
      queryClient.invalidateQueries({ queryKey: documentKeys.list() });

      // 如果创建了子文档，也使父文档的列表失效（作为后备，确保数据同步）
      if (newDoc.parentDocumentId) {
        queryClient.invalidateQueries({
          queryKey: documentKeys.list(newDoc.parentDocumentId),
        });
      }
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateDocument,
    onSuccess: (updatedDoc, variables) => {
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
        queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
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
    onSuccess: () => {
      // 删除后刷新所有列表
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    },
  });
}

export function usePublishDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: publishDocument,
    onSuccess: (updatedDoc) => {
      // 更新单个文档的缓存
      queryClient.setQueryData(
        documentKeys.detail(updatedDoc.id),
        updatedDoc
      );
      // 刷新列表
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    },
  });
}
