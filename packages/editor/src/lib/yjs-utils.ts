import * as Y from "yjs";

/**
 * 将 base64 字符串解码为 Uint8Array，用于恢复 Yjs 文档二进制状态。
 */
export function decodeBase64ToUint8Array(b64: string): Uint8Array {
  const binary = globalThis.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 将 Yjs 文档编码为全量 update（Y.encodeStateAsUpdate 的薄封装）。
 */
export function encodeStateAsUpdate(ydoc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(ydoc);
}
