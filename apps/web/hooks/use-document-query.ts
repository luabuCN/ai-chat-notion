import { useState, useEffect, useCallback, useMemo } from "react";
import type { EditorDocument } from "@repo/database";

export function useSidebarDocuments(parentDocumentId?: string) {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<EditorDocument[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      setIsLoading(true);
      setError(null);
      try {
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

        const documents = await response.json();
        setData(documents);
      } catch (err) {
        const error = err instanceof Error ? err : new Error("获取文档列表失败");
        setError(error);
        setData([]);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchDocuments();
  }, [parentDocumentId]);

  return {
    data,
    isLoading,
    error,
  };
}

export function useCreateDocument() {
  const trigger = useCallback(
    async (
      arg: { title: string; parentDocumentId?: string },
      options?: {
        onSuccess?: (res: EditorDocument) => void;
        onError?: (error: Error) => void;
      }
    ) => {
      try {
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

        const newDoc = await response.json();
        options?.onSuccess?.(newDoc);
        return newDoc;
      } catch (error) {
        const err = error instanceof Error ? error : new Error("创建文档失败");
        options?.onError?.(err);
        throw err;
      }
    },
    []
  );

  return useMemo(() => ({ trigger }), [trigger]);
}

export function useArchive() {
  const trigger = useCallback(
    async (
      documentId: string,
      options?: {
        onSuccess?: () => void;
        onError?: (error: Error) => void;
      }
    ) => {
      try {
        const response = await fetch(`/api/editor-documents/${documentId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "删除文档失败");
        }

        options?.onSuccess?.();
        return { success: true };
      } catch (error) {
        const err = error instanceof Error ? error : new Error("删除文档失败");
        options?.onError?.(err);
        throw err;
      }
    },
    []
  );

  return useMemo(() => ({ trigger }), [trigger]);
}

export function useUpdateDocument() {
  const trigger = useCallback(
    async (
      documentId: string,
      updates: {
        title?: string;
        content?: string;
        coverImage?: string | null;
        coverImageType?: "color" | "url" | null;
        isPublished?: boolean;
      },
      options?: {
        onSuccess?: (res: EditorDocument) => void;
        onError?: (error: Error) => void;
      }
    ) => {
      try {
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

        const updatedDoc = await response.json();
        options?.onSuccess?.(updatedDoc);
        return updatedDoc;
      } catch (error) {
        const err = error instanceof Error ? error : new Error("更新文档失败");
        options?.onError?.(err);
        throw err;
      }
    },
    []
  );

  return useMemo(() => ({ trigger }), [trigger]);
}

export function useGetDocument() {
  const trigger = useCallback(
    async (
      documentId: string,
      options?: {
        onSuccess?: (res: EditorDocument) => void;
        onError?: (error: Error) => void;
      }
    ) => {
      try {
        const response = await fetch(`/api/editor-documents/${documentId}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "获取文档失败");
        }

        const document = await response.json();
        options?.onSuccess?.(document);
        return document;
      } catch (error) {
        const err = error instanceof Error ? error : new Error("获取文档失败");
        options?.onError?.(err);
        throw err;
      }
    },
    []
  );

  return useMemo(() => ({ trigger }), [trigger]);
}

export function usePublishDocument() {
  const trigger = useCallback(
    async (
      documentId: string,
      publish: boolean,
      options?: {
        onSuccess?: (res: EditorDocument) => void;
        onError?: (error: Error) => void;
      }
    ) => {
      try {
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

        const document = await response.json();
        options?.onSuccess?.(document);
        return document;
      } catch (error) {
        const err = error instanceof Error ? error : new Error("发布操作失败");
        options?.onError?.(err);
        throw err;
      }
    },
    []
  );

  return useMemo(() => ({ trigger }), [trigger]);
}
