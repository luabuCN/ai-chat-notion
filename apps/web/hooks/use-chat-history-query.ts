import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import type { Chat } from "@repo/database";
import { apiJson } from "@/lib/api-client";

export type ChatHistory = {
  chats: Chat[];
  hasMore: boolean;
};

const PAGE_SIZE = 20;

export function chatHistoryQueryKey(workspaceSlug?: string) {
  return ["chat-history", workspaceSlug || "personal"] as const;
}

export function buildHistoryUrl(params: {
  limit?: number;
  endingBefore?: string | null;
  workspaceSlug?: string;
}) {
  const search = new URLSearchParams({
    limit: String(params.limit ?? PAGE_SIZE),
  });
  if (params.endingBefore) {
    search.set("ending_before", params.endingBefore);
  }
  if (params.workspaceSlug) {
    search.set("workspace", params.workspaceSlug);
  }
  return `/api/history?${search.toString()}`;
}

export function useChatHistoryQuery(workspaceSlug?: string) {
  return useInfiniteQuery({
    queryKey: chatHistoryQueryKey(workspaceSlug),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiJson<ChatHistory>(
        buildHistoryUrl({ endingBefore: pageParam, workspaceSlug })
      ),
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore) {
        return undefined;
      }
      return lastPage.chats.at(-1)?.id ?? undefined;
    },
  });
}

export function useInvalidateChatHistory() {
  const queryClient = useQueryClient();
  return (workspaceSlug?: string) =>
    queryClient.invalidateQueries({
      queryKey: chatHistoryQueryKey(workspaceSlug),
    });
}
