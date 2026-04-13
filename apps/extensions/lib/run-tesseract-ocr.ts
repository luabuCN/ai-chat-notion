/**
 * 使用 tesseract.js 在页面内对图片 data URL 做 OCR（简体中文 + 英文）。
 * 先经 Canvas 预处理（灰度、对比度、中值去噪、Otsu 二值化）再识别。
 * 动态导入以减小首屏 content script 体积。
 */
import { preprocessDataUrlForOcr } from "@/lib/image-preprocess-ocr";

export async function recognizeImageDataUrl(dataUrl: string): Promise<string> {
  const canvas = await preprocessDataUrlForOcr(dataUrl);
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(["chi_sim", "eng"]);
  try {
    const { data } = await worker.recognize(canvas);
    return data.text.trim();
  } finally {
    await worker.terminate();
  }
}
