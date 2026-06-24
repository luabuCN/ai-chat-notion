"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { TokenQuota } from "@repo/database";
import { apiJson } from "@/lib/api-client";

export function tokenQuotaQueryKey() {
  return ["token-quota"] as const;
}

export function useTokenQuota() {
  const queryClient = useQueryClient();

  const { data: quota, isLoading, isPending } = useQuery({
    queryKey: tokenQuotaQueryKey(),
    queryFn: () => apiJson<TokenQuota>("/api/token-usage"),
  });

  const applyQuotaUpdate = (next: TokenQuota) => {
    queryClient.setQueryData(tokenQuotaQueryKey(), next);
  };

  return { quota, isLoading: isLoading || isPending, applyQuotaUpdate };
}
