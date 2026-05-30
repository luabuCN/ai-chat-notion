import { getApiToken, refreshApiToken } from "@/lib/auth/api-token";
import { API_ORIGIN } from "@/lib/web-config";

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

  let token = await getApiToken();
  if (!token) {
    throw new Error("未登录或无法获取 API Token");
  }

  const doFetch = (t: string) =>
    fetch(`${API_ORIGIN}/api/files/upload`, {
      method: "POST",
      body: formData,
      headers: { Authorization: `Bearer ${t}` },
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    token = (await refreshApiToken()) ?? token;
    res = await doFetch(token);
  }

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
