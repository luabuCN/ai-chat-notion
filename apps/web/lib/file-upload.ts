/**
 * 客户端上传到 `/api/files/upload` 的返回结构（与 route 一致）。
 */
export type FileUploadResult = {
  url: string;
  pathname: string;
  contentType: string;
};

const UPLOAD_FAILED_MESSAGE = "Failed to upload file, please try again!";

/**
 * 将单个文件上传到 Blob 存储，失败时抛出带服务端文案的 Error。
 */
export async function uploadFileToApi(file: File): Promise<FileUploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/files/upload", {
    method: "POST",
    body: formData,
  });

  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    url?: string;
    pathname?: string;
    contentType?: string;
  };

  if (!response.ok) {
    const message =
      typeof body.error === "string" ? body.error : UPLOAD_FAILED_MESSAGE;
    throw new Error(message);
  }

  if (
    typeof body.url !== "string" ||
    typeof body.pathname !== "string" ||
    typeof body.contentType !== "string"
  ) {
    throw new Error(UPLOAD_FAILED_MESSAGE);
  }

  return {
    url: body.url,
    pathname: body.pathname,
    contentType: body.contentType,
  };
}
