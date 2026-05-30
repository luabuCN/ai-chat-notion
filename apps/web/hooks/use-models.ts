import { useQuery } from "@tanstack/react-query";
import type { ModelInfo } from "@/lib/api-types";
import { apiJson } from "@/lib/api-client";

export function useModels() {
  const query = useQuery({
    queryKey: ["models"],
    queryFn: () => apiJson<ModelInfo[]>("/api/models"),
    staleTime: 1000 * 60 * 5,
  });

  return {
    models: query.data ?? [],
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
  };
}
