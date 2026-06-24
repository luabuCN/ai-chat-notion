const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 8000;

function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength
  ) as ArrayBuffer;
}

function extensionForContentType(contentType: string): string {
  if (contentType.includes("jpeg")) {
    return "jpg";
  }
  if (contentType.includes("webp")) {
    return "webp";
  }
  if (contentType.includes("gif")) {
    return "gif";
  }
  return "png";
}

export type ImportImageValidationResult =
  | { ok: true; buffer: Buffer; contentType: string }
  | { ok: false; reason: string };

export async function validateImportImageBuffer(
  buffer: Buffer,
  contentType: string
): Promise<ImportImageValidationResult> {
  if (buffer.byteLength === 0) {
    return { ok: false, reason: "empty image buffer" };
  }

  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    return { ok: false, reason: "image exceeds 5MB limit" };
  }

  const { default: sharp } = await import("sharp");
  let metadata: { width?: number; height?: number; format?: string };

  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    return { ok: false, reason: "invalid image data" };
  }

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width <= 0 || height <= 0) {
    return { ok: false, reason: "missing image dimensions" };
  }

  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    return { ok: false, reason: "image dimensions exceed limit" };
  }

  const normalizedType = ALLOWED_IMAGE_TYPES.has(contentType)
    ? contentType
    : metadata.format
      ? `image/${metadata.format === "jpg" ? "jpeg" : metadata.format}`
      : contentType;

  if (!ALLOWED_IMAGE_TYPES.has(normalizedType)) {
    return { ok: false, reason: `unsupported image type: ${contentType}` };
  }

  return { ok: true, buffer, contentType: normalizedType };
}

export async function uploadImportImageBuffer(
  buffer: Buffer,
  contentType: string,
  fileName: string
): Promise<string | null> {
  const validation = await validateImportImageBuffer(buffer, contentType);
  if (!validation.ok) {
    return null;
  }

  const { UTApi } = await import("uploadthing/server");
  const utapi = new UTApi();
  const extension = extensionForContentType(validation.contentType);
  const blob = new Blob([bufferToArrayBuffer(validation.buffer)], {
    type: validation.contentType,
  });
  const file = new File([blob], `${fileName}.${extension}`, {
    type: validation.contentType,
  });

  try {
    const result = await utapi.uploadFiles(file);
    return result.data?.url ?? null;
  } catch {
    return null;
  }
}
