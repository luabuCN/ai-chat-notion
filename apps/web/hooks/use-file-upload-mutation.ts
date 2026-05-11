import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  type UploadFileToApiOptions,
  uploadFileToApi,
} from "@/lib/file-upload";

const FILE_UPLOAD_MUTATION_KEY = ["file-upload"] as const;

export type FileUploadMutationInput =
  | File
  | { file: File; relaxMimeTypes?: boolean };

function normalizeUploadInput(input: FileUploadMutationInput): {
  file: File;
  options: UploadFileToApiOptions;
} {
  if (input instanceof File) {
    return { file: input, options: {} };
  }
  return {
    file: input.file,
    options: { relaxMimeTypes: Boolean(input.relaxMimeTypes) },
  };
}

export function useFileUploadMutation() {
  return useMutation({
    mutationKey: FILE_UPLOAD_MUTATION_KEY,
    mutationFn: (input: FileUploadMutationInput) => {
      const { file, options } = normalizeUploadInput(input);
      return uploadFileToApi(file, options);
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to upload file, please try again!";
      toast.error(message);
    },
  });
}
