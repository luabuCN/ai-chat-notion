import mammoth from "mammoth";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { shouldPreferHtmlImport } from "./docx-complexity.js";
import { filterMammothMessages } from "./filter-mammoth-messages.js";
import { getDocxStyleMap } from "./docx-style-map.js";
import { normalizeMarkdown } from "./normalize-markdown.js";
import { polishImportMarkdown } from "./polish-import-markdown.js";
import { sanitizeImportHtml } from "./sanitize-import-html.js";
import type { ImportedAsset, ImportedDocument, ImportPolishMode } from "./types.js";
import { uploadImportImageBuffer } from "./upload-import-image.js";

function htmlToMarkdown(html: string): string {
  const turndown = new TurndownService({
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    headingStyle: "atx",
  });

  turndown.use(gfm);

  return normalizeMarkdown(turndown.turndown(html));
}

function createMammothImageConverter(
  assets: ImportedAsset[],
  warnings: string[]
) {
  let imageIndex = 0;

  return mammoth.images.imgElement(async (image) => {
    imageIndex += 1;
    const buffer = await image.readAsBuffer();
    const fileName = `docx-import-${Date.now()}-${imageIndex}`;
    const url = await uploadImportImageBuffer(
      buffer,
      image.contentType,
      fileName
    );

    if (!url) {
      warnings.push(`DOCX 图片 ${imageIndex} 上传失败，已跳过。`);
      return { src: "" };
    }

    assets.push({
      name: fileName,
      contentType: image.contentType,
      url,
    });

    return { src: url };
  });
}

export async function parseDocxDocument(
  buffer: ArrayBuffer,
  title: string,
  polish: ImportPolishMode = "auto"
): Promise<ImportedDocument> {
  const assets: ImportedAsset[] = [];
  const warnings: string[] = [];

  const result = await mammoth.convertToHtml(
    { buffer: Buffer.from(buffer) },
    {
      styleMap: getDocxStyleMap(),
      includeDefaultStyleMap: true,
      convertImage: createMammothImageConverter(assets, warnings),
    }
  );

  warnings.push(
    ...filterMammothMessages(
      result.messages.map((message) => message.message)
    )
  );

  const rawHtml = result.value;
  const sanitizedHtml = sanitizeImportHtml(rawHtml);
  const imageCount = assets.length;
  const preferHtml = shouldPreferHtmlImport(sanitizedHtml, imageCount);
  const rawMarkdown = htmlToMarkdown(sanitizedHtml);
  const markdown = preferHtml
    ? rawMarkdown
    : await polishImportMarkdown("docx", rawMarkdown, polish);

  return {
    kind: "docx",
    title,
    contentFormat: preferHtml ? "html" : "markdown",
    markdown,
    rawMarkdown,
    html: sanitizedHtml,
    assets,
    warnings,
    stats: { imageCount },
  };
}
