import { WEB_ORIGIN } from "@/lib/web-config";
import { webFetchWithMainSiteCookies } from "@/lib/web-fetch";

export type MainSiteFileUploadResult = {
  url: string;
  pathname: string;
  contentType: string;
};

export async function uploadFileToMainSite(
  file: File,
): Promise<MainSiteFileUploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await webFetchWithMainSiteCookies(
    `${WEB_ORIGIN}/api/files/upload`,
    {
      method: "POST",
      body: formData,
    },
  );
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    url?: string;
    pathname?: string;
    contentType?: string;
  };
  if (!res.ok) {
    const msg =
      typeof body.error === "string" ? body.error : "上传失败，请稍后重试";
    throw new Error(msg);
  }
  if (
    typeof body.url !== "string" ||
    typeof body.pathname !== "string" ||
    typeof body.contentType !== "string"
  ) {
    throw new Error("上传失败，请稍后重试");
  }
  return {
    url: body.url,
    pathname: body.pathname,
    contentType: body.contentType,
  };
}
