import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import type { PDFPageProxy } from "pdfjs-dist";
import type {
  ExtractResult,
  ImageElement,
  PageContent,
  PageElement,
  RawImageData,
  TextElement,
} from "./types";

const IDENTITY_MATRIX = [1, 0, 0, 1, 0, 0] as const;

function multiplyMatrices(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

async function getPdfjsLib() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const require = createRequire(import.meta.url);
  const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
  return pdfjs;
}

async function extractTextElements(
  page: PDFPageProxy,
  pageHeight: number
): Promise<TextElement[]> {
  const textContent = await page.getTextContent();
  const elements: TextElement[] = [];

  for (const item of textContent.items) {
    if (!("str" in item)) continue;
    const x = item.transform[4];
    const y = pageHeight - item.transform[5];
    const fontSize = Math.sqrt(item.transform[0] ** 2 + item.transform[1] ** 2);
    const isBold = /bold|heavy|black/i.test(item.fontName ?? "");
    elements.push({
      type: "text",
      content: item.str,
      x,
      y,
      width: item.width,
      height: fontSize,
      fontSize,
      isBold,
    });
  }

  return elements;
}

type PdfjsRawImage = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  kind?: number;
};

/**
 * 从已填充的 page.objs 中同步读取图片数据。
 * 必须在 getOperatorList() 之后调用，此时 objs 已经解码完毕，
 * get() 的回调会同步触发（或在微任务中触发）。
 */
function getObjImage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  objs: any,
  name: string
): Promise<PdfjsRawImage | null> {
  return new Promise((resolve) => {
    // 5 秒超时保护，防止某些图片 objs 未填充时永远 pending
    const timer = setTimeout(() => resolve(null), 5_000);
    objs.get(name, (img: PdfjsRawImage | null) => {
      clearTimeout(timer);
      resolve(img ?? null);
    });
  });
}

async function extractImageElementsAndData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  pageHeight: number,
  OPS: Record<string, number>,
  rawImagesMap: Map<string, RawImageData>
): Promise<ImageElement[]> {
  // getOperatorList 会触发图片解码，之后 page.objs 才有数据
  const ops = await page.getOperatorList() as {
    fnArray: number[];
    argsArray: unknown[][];
  };

  let transformStack: number[][] = [];
  let currentTransform = [...IDENTITY_MATRIX] as number[];
  const imagePromises: Promise<ImageElement | null>[] = [];

  for (let j = 0; j < ops.fnArray.length; j++) {
    const fn = ops.fnArray[j];
    const args = ops.argsArray[j] as unknown[];

    if (fn === OPS.save) {
      transformStack.push([...currentTransform]);
    } else if (fn === OPS.restore) {
      currentTransform = transformStack.pop() ?? [...IDENTITY_MATRIX];
    } else if (fn === OPS.transform) {
      if (Array.isArray(args) && args.length === 6) {
        currentTransform = multiplyMatrices(currentTransform, args as number[]);
      }
    } else if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject) {
      if (!Array.isArray(args) || args.length === 0) continue;
      const imageName = args[0] as string;
      const matrix = [...currentTransform];

      const imgPromise = getObjImage(page.objs, imageName).then(
        (image): ImageElement | null => {
          if (!image?.data || !image.width || !image.height) return null;

          // 顺便把原始像素数据存入 map，供 upload-images.ts 直接使用
          if (!rawImagesMap.has(imageName)) {
            rawImagesMap.set(imageName, {
              name: imageName,
              data: image.data,
              width: image.width,
              height: image.height,
              kind: image.kind ?? 3,
            });
          }

          return {
            type: "image",
            url: `__pending__:${imageName}`,
            name: imageName,
            x: matrix[4],
            y: pageHeight - (matrix[5] + matrix[3]),
            width: Math.abs(matrix[0]),
            height: Math.abs(matrix[3]),
          };
        }
      );
      imagePromises.push(imgPromise);
    }
  }

  const results = await Promise.all(imagePromises);
  return results.filter((img): img is ImageElement => img !== null);
}

export async function extractPdfContent(buffer: ArrayBuffer): Promise<ExtractResult> {
  const pdfjs = await getPdfjsLib();

  const typedArray = new Uint8Array(buffer);
  const pdf = await pdfjs
    .getDocument({
      data: typedArray,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    })
    .promise;

  const totalPages = pdf.numPages;
  const allPages: PageContent[] = [];
  // 用 Map 去重，同名图片只存一份
  const rawImagesMap = new Map<string, RawImageData>();

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    const pageHeight = viewport.height;

    const textElements = await extractTextElements(
      page as unknown as PDFPageProxy,
      pageHeight
    );
    const imageElements = await extractImageElementsAndData(
      page,
      pageHeight,
      pdfjs.OPS as unknown as Record<string, number>,
      rawImagesMap
    );

    const combined: PageElement[] = [...textElements, ...imageElements];
    combined.sort((a, b) => {
      if (Math.abs(a.y - b.y) > 5) return a.y - b.y;
      return a.x - b.x;
    });

    allPages.push({ page: i, elements: combined });
  }

  return {
    pageContents: allPages,
    rawImages: [...rawImagesMap.values()],
  };
}
