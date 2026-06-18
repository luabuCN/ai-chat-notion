import * as Y from "yjs";
import {
  ASSETS_DOC_KEY,
  BLOCKS_MAP_KEY,
  ELEMENTS_DOC_KEY,
} from "../constants";
import type { WhiteboardScope } from "../types";

export type WhiteboardYScope = {
  elements: Y.Map<unknown>;
  assets: Y.Map<unknown>;
};

function getBlockInnerMap(
  blocks: Y.Map<unknown>,
  blockId: string,
  create: boolean
): Y.Map<unknown> | null {
  const existing = blocks.get(blockId);
  if (existing instanceof Y.Map) {
    return existing;
  }
  if (!create) {
    return null;
  }
  const block = new Y.Map<unknown>();
  block.set("elements", new Y.Map<unknown>());
  block.set("assets", new Y.Map<unknown>());
  blocks.set(blockId, block);
  return block;
}

export function getWhiteboardYScope(
  ydoc: Y.Doc,
  scope: WhiteboardScope,
  create = true
): WhiteboardYScope {
  if (scope.type === "document") {
    return {
      elements: ydoc.getMap(ELEMENTS_DOC_KEY),
      assets: ydoc.getMap(ASSETS_DOC_KEY),
    };
  }

  const blocks = ydoc.getMap(BLOCKS_MAP_KEY);
  const block = getBlockInnerMap(blocks, scope.blockId, create);
  if (!block) {
    return {
      elements: new Y.Map<unknown>(),
      assets: new Y.Map<unknown>(),
    };
  }

  let elements = block.get("elements");
  let assets = block.get("assets");
  if (!(elements instanceof Y.Map)) {
    elements = new Y.Map<unknown>();
    block.set("elements", elements);
  }
  if (!(assets instanceof Y.Map)) {
    assets = new Y.Map<unknown>();
    block.set("assets", assets);
  }

  return {
    elements: elements as Y.Map<unknown>,
    assets: assets as Y.Map<unknown>,
  };
}

export function ensureBlockState(ydoc: Y.Doc, blockId: string): void {
  ydoc.transact(() => {
    getWhiteboardYScope(ydoc, { type: "block", blockId }, true);
  });
}

export function removeBlockState(ydoc: Y.Doc, blockId: string): void {
  ydoc.transact(() => {
    const blocks = ydoc.getMap(BLOCKS_MAP_KEY);
    blocks.delete(blockId);
  });
}

export function elementsFromYMap(yMap: Y.Map<unknown>): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  yMap.forEach((value) => {
    if (value && typeof value === "object") {
      out.push(value as Record<string, unknown>);
    }
  });
  return out;
}

export function filesFromYMap(
  yMap: Y.Map<unknown>
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  yMap.forEach((value, key) => {
    if (value && typeof value === "object") {
      out[key] = value as Record<string, unknown>;
    }
  });
  return out;
}

export function syncElementsToYMap(
  ydoc: Y.Doc,
  yMap: Y.Map<unknown>,
  elements: readonly Record<string, unknown>[],
  origin?: string
): void {
  ydoc.transact(() => {
    const ids = new Set(elements.map((el) => String(el.id)));
    for (const key of yMap.keys()) {
      if (!ids.has(key)) {
        yMap.delete(key);
      }
    }
    for (const el of elements) {
      yMap.set(String(el.id), el);
    }
  }, origin);
}

export function syncFilesToYMap(
  ydoc: Y.Doc,
  yMap: Y.Map<unknown>,
  files: Record<string, Record<string, unknown>>,
  origin?: string
): void {
  ydoc.transact(() => {
    const ids = new Set(Object.keys(files));
    for (const key of yMap.keys()) {
      if (!ids.has(key)) {
        yMap.delete(key);
      }
    }
    for (const [id, file] of Object.entries(files)) {
      yMap.set(id, file);
    }
  }, origin);
}
