/**
 * 将页面上的 `<img>` 转为 data URL。
 * 顺序：1) data: 直出 2) Canvas（同源/CORS 已解码）3) 页面内 fetch 4) background fetch（扩展权限，绕过页面 CORS）。
 */

import { blobToDataUrl } from "@/lib/blob-to-data-url";
import { sendMessage } from "@/lib/messaging/extension-messaging";

const resolveImageUrl = (src: string): string => {
  try {
    return new URL(src, window.location.href).href;
  } catch {
    return src;
  }
};

const isHttpOrHttps = (href: string): boolean => {
  try {
    const u = new URL(href);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const waitForImageDecoded = async (
  img: HTMLImageElement,
): Promise<boolean> => {
  if (img.complete && img.naturalWidth > 0) {
    return true;
  }
  try {
    await img.decode();
  } catch {
    return false;
  }
  return img.naturalWidth > 0;
};

const tryDataUrlFromCanvas = (img: HTMLImageElement): string | null => {
  if (!img.complete || img.naturalWidth === 0) {
    return null;
  }
  try {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
};

const fetchSrcAsDataUrlInPage = async (
  src: string,
): Promise<{ dataUrl: string } | { error: string }> => {
  try {
    const res = await fetch(src, { credentials: "omit", mode: "cors" });
    if (!res.ok) {
      return { error: "无法加载图片（可能被跨域限制）" };
    }
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) {
      return { error: "不是有效的图片内容" };
    }
    const dataUrl = await blobToDataUrl(blob);
    return { dataUrl };
  } catch {
    return { error: "无法读取图片（跨域或网络错误）" };
  }
};

const fetchImageUrlViaExtension = async (
  src: string,
): Promise<{ dataUrl: string } | { error: string }> => {
  const url = resolveImageUrl(src);
  if (!isHttpOrHttps(url)) {
    return { error: "无法读取图片（跨域或网络错误）" };
  }
  try {
    return await sendMessage("fetchImageUrlAsDataUrl", {
      url,
      referrer: window.location.href,
    });
  } catch {
    return { error: "无法读取图片（扩展拉取失败）" };
  }
};

export async function imageElementToDataUrl(
  img: HTMLImageElement,
): Promise<{ dataUrl: string } | { error: string }> {
  const src = img.currentSrc || img.src;
  if (!src) {
    return { error: "无法读取图片地址" };
  }
  if (src.startsWith("data:")) {
    return { dataUrl: src };
  }

  const decoded = await waitForImageDecoded(img);
  if (decoded) {
    const fromCanvas = tryDataUrlFromCanvas(img);
    if (fromCanvas !== null) {
      return { dataUrl: fromCanvas };
    }
  }

  const pageResult = await fetchSrcAsDataUrlInPage(src);
  if (!("error" in pageResult)) {
    return pageResult;
  }

  return fetchImageUrlViaExtension(src);
}
