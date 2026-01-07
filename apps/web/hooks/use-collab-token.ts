import { useQuery } from "@tanstack/react-query";

interface CollabTokenResponse {
  token: string;
  accessLevel: "owner" | "edit" | "view";
  expiresIn: number;
}

async function fetchCollabToken(documentId: string): Promise<CollabTokenResponse> {
  const response = await fetch("/api/collab/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ documentId }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to get collaboration token");
  }

  return response.json();
}

/**
 * 获取协同编辑 token 的 Hook
 */
export function useCollabToken(documentId: string | null | undefined) {
  return useQuery({
    queryKey: ["collab-token", documentId],
    queryFn: () => fetchCollabToken(documentId!),
    enabled: !!documentId,
    staleTime: 1000 * 60 * 60, // 1 小时后过期重新获取
    gcTime: 1000 * 60 * 60 * 2, // 2 小时后清理缓存
    retry: 2,
  });
}

