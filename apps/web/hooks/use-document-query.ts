import { useState, useEffect } from "react";
import { generateUUID } from "@/lib/utils";
import type { Document } from "@repo/database";

// 写死的数据
const mockDocuments: Document[] = [
  {
    id: "1",
    title: "Nextjs的缓存机制",
    content: "",
    kind: "text",
    userId: "user-1",
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "2",
    title: "React Server Components",
    content: "",
    kind: "text",
    userId: "user-1",
    createdAt: new Date("2024-01-02"),
  },
  {
    id: "3",
    title: "Project Ideas.txt",
    content: "",
    kind: "text",
    userId: "user-1",
    createdAt: new Date("2024-01-03"),
  },
];

// 全局数据存储（模拟）
let documentsStore: Document[] = [...mockDocuments];

export function useSidebarDocuments(parentDocumentId?: string) {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<Document[]>([]);

  useEffect(() => {
    // 模拟加载，使用定时器
    setIsLoading(true);
    const timer = setTimeout(() => {
      setData([...documentsStore]);
      setIsLoading(false);
    }, 1000); // 1秒延迟

    return () => clearTimeout(timer);
  }, []);

  // 由于当前数据库 schema 不支持层级结构，这里返回所有文档
  // 如果将来支持 parentDocumentId，可以在这里过滤
  return {
    data: parentDocumentId
      ? data.filter((doc) => doc.id === parentDocumentId)
      : data,
    isLoading,
    error: null,
  };
}

export function useCreateDocument() {
  return {
    trigger: async (
      arg: { title: string; parentDocumentId?: string },
      options?: {
        onSuccess?: (res: Document) => void;
        onError?: (error: Error) => void;
      }
    ) => {
      try {
        const newDoc: Document = {
          id: generateUUID(),
          title: arg.title,
          content: "",
          kind: "text",
          userId: "user-1",
          createdAt: new Date(),
        };
        
        documentsStore.push(newDoc);
        options?.onSuccess?.(newDoc);
        return newDoc;
      } catch (error) {
        const err = error instanceof Error ? error : new Error("创建文档失败");
        options?.onError?.(err);
        throw err;
      }
    },
  };
}

export function useArchive() {
  return {
    trigger: async (
      documentId: string,
      options?: {
        onSuccess?: () => void;
        onError?: (error: Error) => void;
      }
    ) => {
      try {
        const index = documentsStore.findIndex((doc) => doc.id === documentId);
        if (index === -1) {
          throw new Error("文档不存在");
        }
        
        documentsStore = documentsStore.filter((doc) => doc.id !== documentId);
        options?.onSuccess?.();
        return { success: true };
      } catch (error) {
        const err = error instanceof Error ? error : new Error("删除文档失败");
        options?.onError?.(err);
        throw err;
      }
    },
  };
}
