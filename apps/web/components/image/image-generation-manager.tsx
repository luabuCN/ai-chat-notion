"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/toast";
import {
  hydrateImageGenerationTasksFromSession,
} from "@/lib/image-generation/generation-store";
import {
  notifyImageGenerationComplete,
  resumePendingImagePolls,
} from "@/lib/image-generation/generation-runner";

export function ImageGenerationManager() {
  const queryClient = useQueryClient();

  useEffect(() => {
    hydrateImageGenerationTasksFromSession();

    resumePendingImagePolls({
      onComplete: () => {
        toast({
          type: "success",
          description: "图片已生成并自动上传到素材库",
        });
        void queryClient.invalidateQueries({ queryKey: ["image-history"] });
      },
      onFailed: (_taskId, error) => {
        toast({ type: "error", description: error });
        void queryClient.invalidateQueries({ queryKey: ["image-history"] });
      },
    });

    const handleWsMessage = (event: Event) => {
      const detail = (event as CustomEvent<{
        providerTaskId?: string;
        outputImageUrl?: string;
      }>).detail;

      if (!detail?.providerTaskId || !detail.outputImageUrl) {
        return;
      }

      notifyImageGenerationComplete(
        detail.providerTaskId,
        detail.outputImageUrl
      );
      void queryClient.invalidateQueries({ queryKey: ["image-history"] });
    };

    window.addEventListener("image-generation-complete", handleWsMessage);
    return () => {
      window.removeEventListener("image-generation-complete", handleWsMessage);
    };
  }, [queryClient]);

  return null;
}
