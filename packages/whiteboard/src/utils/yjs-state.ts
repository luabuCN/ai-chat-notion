import * as Y from "yjs";

export function decodeBase64ToUint8Array(b64: string): Uint8Array {
  const binary = globalThis.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function createWhiteboardDocFromBase64(
  yjsStateB64: string | null | undefined
): Y.Doc {
  const doc = new Y.Doc();
  if (yjsStateB64) {
    try {
      Y.applyUpdate(doc, decodeBase64ToUint8Array(yjsStateB64));
    } catch {
      // ignore invalid snapshot
    }
  }
  return doc;
}
