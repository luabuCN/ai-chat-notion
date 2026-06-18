import { gunzipSync } from "node:zlib";

export function isGzipCompressed(
  buffer: Buffer | Uint8Array
): boolean {
  return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
}

/** 将数据库中的 yjsState（可能 gzip 压缩）规范化为原始二进制 */
export function normalizeYjsStateBuffer(
  yjsState: Buffer | Uint8Array | null | undefined
): Buffer | null {
  if (!yjsState || yjsState.length === 0) {
    return null;
  }
  let buf = Buffer.from(yjsState);
  if (isGzipCompressed(buf)) {
    buf = gunzipSync(buf);
  }
  return buf;
}

/** 供 API / 预览使用的 base64 序列化（自动解压） */
export function serializeYjsStateToBase64(
  yjsState: Buffer | Uint8Array | null | undefined
): string | null {
  const buf = normalizeYjsStateBuffer(yjsState);
  if (!buf) {
    return null;
  }
  return buf.toString("base64");
}
