export type TextElement = {
  type: "text";
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  isBold: boolean;
};

export type ImageElement = {
  type: "image";
  /** UploadThing 上传后的真实 URL，解析阶段为 `__pending__:<name>` 占位符 */
  url: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PageElement = TextElement | ImageElement;

export type PageContent = {
  page: number;
  elements: PageElement[];
};

export type PdfParseResult = {
  markdown: string;
  rawMarkdown: string;
  pageCount: number;
};

/** 解析阶段从 pdfjs objs 提取的原始图片像素数据，用于后续上传 */
export type RawImageData = {
  name: string;
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** pdfjs ImageKind: 1=GRAYSCALE_1BPP, 2=RGB_24BPP, 3=RGBA_32BPP */
  kind: number;
};

/** extractPdfContent 的完整返回，同时携带待上传的原始图片数据 */
export type ExtractResult = {
  pageContents: PageContent[];
  rawImages: RawImageData[];
};
