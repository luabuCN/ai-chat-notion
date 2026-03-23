import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { uploadFileToApi } from "@/lib/file-upload";

const FILE_UPLOAD_MUTATION_KEY = ["file-upload"] as const;

export function useFileUploadMutation() {
  return useMutation({
    mutationKey: FILE_UPLOAD_MUTATION_KEY,
    mutationFn: uploadFileToApi,
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to upload file, please try again!";
      toast.error(message);
    },
  });
}
