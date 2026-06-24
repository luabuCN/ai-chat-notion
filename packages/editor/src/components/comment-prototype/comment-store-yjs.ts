import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { useEffect, useState } from "react";
import * as Y from "yjs";
import type { CommentPrototypeEntry } from "./comment-prototype-form";

/**
 * 评论按"块级 stable id"挂在同一份 `Y.Doc` 上，正文/评论 CRDT 合并，统一通过
 * collab-server 的 Yjs 持久化落盘。
 *
 * 数据形状：
 *   ydoc.getMap(COMMENTS_MAP_KEY): Y.Map<blockId, Y.Array<CommentPrototypeEntry>>
 *
 * - 选择 `Y.Array` 而非 ProseMirror 节点 `attrs.comments`，避免 ProseMirror attrs
 *   的"整体替换"语义导致并发添加丢失更新。
 * - blockId 由 `@tiptap/extension-unique-id` 写入到每个块的 `attrs.id`，保证
 *   重新挂载/段落顺序变化后锚点稳定。
 */
export const COMMENTS_MAP_KEY = "comment-threads-v1";

type ThreadsArray = Y.Array<CommentPrototypeEntry>;

function getCommentsRoot(ydoc: Y.Doc): Y.Map<ThreadsArray> {
  return ydoc.getMap<ThreadsArray>(COMMENTS_MAP_KEY);
}

function snapshotComments(
  root: Y.Map<ThreadsArray>
): Record<string, CommentPrototypeEntry[]> {
  const out: Record<string, CommentPrototypeEntry[]> = {};
  root.forEach((arr, blockId) => {
    if (!(arr instanceof Y.Array)) {
      return;
    }
    const items = arr.toArray();
    if (items.length > 0) {
      out[blockId] = items;
    }
  });
  return out;
}

/**
 * 订阅当前文档所有评论线程，按 blockId 聚合。
 * 在 `ydoc` 为空时返回空对象，便于上游退化为只读 UI。
 */
export function useCommentThreadsByBlockId(
  ydoc: Y.Doc | null | undefined
): Record<string, CommentPrototypeEntry[]> {
  const [snapshot, setSnapshot] = useState<
    Record<string, CommentPrototypeEntry[]>
  >({});

  useEffect(() => {
    if (!ydoc) {
      setSnapshot({});
      return;
    }

    const root = getCommentsRoot(ydoc);
    setSnapshot(snapshotComments(root));

    const onChange = () => {
      setSnapshot(snapshotComments(root));
    };

    root.observeDeep(onChange);
    return () => {
      root.unobserveDeep(onChange);
    };
  }, [ydoc]);

  return snapshot;
}

export function addCommentToBlock(
  ydoc: Y.Doc,
  blockId: string,
  entry: CommentPrototypeEntry
): void {
  ydoc.transact(() => {
    const root = getCommentsRoot(ydoc);
    let arr = root.get(blockId);
    if (!(arr instanceof Y.Array)) {
      arr = new Y.Array<CommentPrototypeEntry>();
      root.set(blockId, arr);
    }
    arr.push([entry]);
  });
}

export function deleteCommentFromBlock(
  ydoc: Y.Doc,
  blockId: string,
  commentId: string
): void {
  ydoc.transact(() => {
    const root = getCommentsRoot(ydoc);
    const arr = root.get(blockId);
    if (!(arr instanceof Y.Array)) {
      return;
    }
    const items = arr.toArray();
    const index = items.findIndex((c) => c.id === commentId);
    if (index >= 0) {
      arr.delete(index, 1);
    }
    if (arr.length === 0) {
      root.delete(blockId);
    }
  });
}

function collectBlockIdsInDoc(doc: ProseMirrorNode): Set<string> {
  const ids = new Set<string>();
  doc.descendants((node) => {
    const rawId = node.attrs?.id;
    if (typeof rawId === "string" && rawId.length > 0) {
      ids.add(rawId);
    }
    return true;
  });
  return ids;
}

/**
 * 正文块被删除后，清理 Y.Doc 中已无对应块的评论线程。
 */
export function purgeOrphanedCommentThreads(
  ydoc: Y.Doc,
  doc: ProseMirrorNode
): void {
  const liveBlockIds = collectBlockIdsInDoc(doc);
  ydoc.transact(() => {
    const root = getCommentsRoot(ydoc);
    const orphanBlockIds: string[] = [];
    root.forEach((_arr, blockId) => {
      if (!liveBlockIds.has(blockId)) {
        orphanBlockIds.push(blockId);
      }
    });
    for (const blockId of orphanBlockIds) {
      root.delete(blockId);
    }
  });
}
