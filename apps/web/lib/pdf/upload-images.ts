import { UTApi } from "uploadthing/server";
import type { PageContent, RawImageData } from "./types";

const utapi = new UTApi();

const PENDING_PREFIX = "__pending__:";

/** 用 sharp 把 pdfjs 原始像素数据编码为 PNG Buffer */
async function rawImageToPng(img: RawImageData): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  const { data, width, height, kind } = img;

  // pdfjs ImageKind: 1=GRAYSCALE_1BPP, 2=RGB_24BPP, 3=RGBA_32BPP
  const channels = kind === 2 ? 3 : 4;

  return sharp(Buffer.from(data), {
    raw: { width, height, channels },
  })
    .png()
    .toBuffer();
}

/** Buffer → ArrayBuffer，避免 SharedArrayBuffer 类型冲突 */
function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength
  ) as ArrayBuffer;
}

/**
 * 将解析阶段提取的原始图片并发上传到 UploadThing，
 * 再把 pageContents 里的占位符 URL 替换为真实 URL。
 */
export async function uploadImagesToStorage(
  pageContents: PageContent[],
  rawImages: RawImageData[]
): Promise<PageContent[]> {
  if (rawImages.length === 0) return pageContents;

  // 并发编码 + 上传所有图片
  const uploadResults = await Promise.all(
    rawImages.map(async (img): Promise<[string, string | null]> => {
      try {
        const pngBuffer = await rawImageToPng(img);
        const blob = new Blob([bufferToArrayBuffer(pngBuffer)], {
          type: "image/png",
        });
        const file = new File([blob], `${img.name}.png`, { type: "image/png" });
        const result = await utapi.uploadFiles(file);
        return [img.name, result.data?.url ?? null];
      } catch {
        return [img.name, null];
      }
    })
  );

  const urlMap = new Map<string, string>(
    uploadResults.filter((r): r is [string, string] => r[1] !== null)
  );

  // 替换占位符 URL
  return pageContents.map((page) => ({
    ...page,
    elements: page.elements.map((el) => {
      if (el.type === "image" && el.url.startsWith(PENDING_PREFIX)) {
        const uploadedUrl = urlMap.get(el.name);
        return uploadedUrl ? { ...el, url: uploadedUrl } : el;
      }
      return el;
    }),
  }));
}
