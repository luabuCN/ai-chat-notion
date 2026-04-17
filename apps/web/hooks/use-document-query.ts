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
    sourcePdfUrl?: string | null;
    sourcePageUrl?: string | null;
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

async function setDocumentPublicEdit({
  documentId,
  enable,
}: {
  documentId: string;
  enable: boolean;
}): Promise<EditorDocument> {
  const response = await fetch(
    `/api/editor-documents/${documentId}/public-edit`,
    {
      method: enable ? "POST" : "DELETE",
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "公开协作操作失败");
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
    onSuccess: (newDoc) => {
      // 乐观更新：将新文档注入到所有匹配父级的列表缓存中
      // （列表 key 包含 workspaceId，遍历所有已缓存 key 以命中正确条目）
      const allListQueries = queryClient.getQueriesData<EditorDocument[]>({
        queryKey: documentKeys.lists(),
      });

      for (const [key, data] of allListQueries) {
        const params = key.at(-1) as
          | { parentDocumentId?: string; workspaceId?: string }
          | undefined;

        const matchesParent =
          (newDoc.parentDocumentId && params?.parentDocumentId === newDoc.parentDocumentId) ||
          (!newDoc.parentDocumentId && !params?.parentDocumentId);

        if (matchesParent && data) {
          if (!data.some((doc) => doc.id === newDoc.id)) {
            queryClient.setQueryData<EditorDocument[]>(key, [...data, newDoc]);
          }
        }
      }

      // 不 await：让 invalidation 后台进行，不阻塞组件的 onSuccess 回调
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: documentKeys.updates(),
    mutationFn: updateDocument,

    // 乐观更新: 在 API 调用前立即更新 UI
    onMutate: async (variables) => {
      // 取消正在进行的查询,避免覆盖乐观更新
      await queryClient.cancelQueries({ queryKey: documentKeys.lists() });
      await queryClient.cancelQueries({
        queryKey: documentKeys.detail(variables.documentId),
      });

      // 保存旧数据用于回滚
      const previousLists = queryClient.getQueriesData<EditorDocument[]>({
        queryKey: documentKeys.lists(),
      });
      const previousDetail = queryClient.getQueryData(
        documentKeys.detail(variables.documentId)
      );

      // 立即更新所有列表缓存中的文档
      if (
        variables.updates.title !== undefined ||
        variables.updates.icon !== undefined
      ) {
        queryClient.setQueriesData<EditorDocument[]>(
          { queryKey: documentKeys.lists() },
          (oldData) => {
            if (!oldData) return oldData;
            return oldData.map((doc) =>
              doc.id === variables.documentId
                ? {
                    ...doc,
                    ...(variables.updates.title !== undefined && {
                      title: variables.updates.title,
                    }),
                    ...(variables.updates.icon !== undefined && {
                      icon: variables.updates.icon,
                    }),
                  }
                : doc
            );
          }
        );
      }

      // 更新单个文档的缓存
      queryClient.setQueryData(
        documentKeys.detail(variables.documentId),
        (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            ...variables.updates,
          };
        }
      );

      // 返回上下文用于回滚
      return { previousLists, previousDetail };
    },

    // 成功时: 用服务端返回的数据更新缓存
    onSuccess: async (updatedDoc, variables) => {
      // 更新单个文档的缓存，保留协同编辑相关字段
      queryClient.setQueryData(
        documentKeys.detail(variables.documentId),
        (oldData: any) => {
          if (!oldData) return updatedDoc;
          return {
            ...updatedDoc,
            accessLevel: oldData.accessLevel,
            hasCollaborators: oldData.hasCollaborators,
            isCurrentUserCollaborator: oldData.isCurrentUserCollaborator,
          };
        }
      );
    },

    // 失败时: 回滚到之前的数据
    onError: (err, variables, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(
          documentKeys.detail(variables.documentId),
          context.previousDetail
        );
      }
    },
  });
}

export function useArchive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDocument,
    onSuccess: (_data, documentId) => {
      // 刷新所有列表
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
      // 刷新垃圾箱列表
      queryClient.invalidateQueries({ queryKey: documentKeys.trashes() });
      // 刷新文档详情缓存，确保从回收站打开时能正确显示删除状态
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(documentId) });
    },
  });
}

export function usePublishDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: publishDocument,
    onSuccess: async (updatedDoc) => {
      // 更新单个文档的缓存（包含新的 publicShareToken）
      queryClient.setQueryData(
        documentKeys.detail(updatedDoc.id),
        (oldData: any) => {
          // 合并新数据和旧数据的协同相关字段
          if (oldData) {
            return {
              ...oldData,
              ...updatedDoc,
            };
          }
          return updatedDoc;
        }
      );
      // 同时 invalidate 以确保数据最新
      await queryClient.invalidateQueries({
        queryKey: documentKeys.detail(updatedDoc.id),
      });
      // 刷新列表
      await queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    },
  });
}

export function usePublicEditDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setDocumentPublicEdit,
    onSuccess: async (updatedDoc) => {
      queryClient.setQueryData(
        documentKeys.detail(updatedDoc.id),
        (oldData: any) => {
          if (oldData) {
            return {
              ...oldData,
              ...updatedDoc,
            };
          }
          return updatedDoc;
        }
      );
      await queryClient.invalidateQueries({
        queryKey: documentKeys.detail(updatedDoc.id),
      });
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
    onSuccess: async (_data, documentId) => {
      // 取消可能正在进行的该查询请求
      await queryClient.cancelQueries({ queryKey: documentKeys.detail(documentId) });
      // 从缓存中移除该文档详情，确保下次读取时强制重新请求
      queryClient.removeQueries({ queryKey: documentKeys.detail(documentId) });
      // Refresh trash list
      queryClient.invalidateQueries({ queryKey: documentKeys.trashes() });
      // Refresh main lists as document reappears
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
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
