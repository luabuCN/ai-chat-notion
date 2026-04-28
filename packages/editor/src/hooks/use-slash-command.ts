import type { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { Editor } from "@tiptap/react";
import type { MouseEvent } from "react";
import { useCallback, useRef } from "react";

function appendListChildItem(editor: Editor, listNode: PMNode, listStartPos: number) {
  const schema = editor.state.schema;
  const insertAt = listStartPos + listNode.nodeSize - 1;
  const lastItem = listNode.lastChild;

  let newItem: PMNode;
  if (lastItem) {
    const paragraph = schema.nodes.paragraph?.create();
    if (!paragraph) {
      return false;
    }
    newItem = lastItem.type.create(lastItem.attrs, paragraph);
  } else {
    const listItem = schema.nodes.listItem;
    const paragraph = schema.nodes.paragraph?.create();
    if (!listItem || !paragraph) {
      return false;
    }
    newItem = listItem.create(null, paragraph);
  }

  return editor
    .chain()
    .focus()
    .command(({ tr, dispatch }) => {
      tr.insert(insertAt, newItem);
      let cursor = insertAt + 1;
      tr.doc.nodesBetween(
        insertAt + 1,
        insertAt + newItem.nodeSize,
        (node, pos) => {
          if (node.isTextblock) {
            cursor = pos + 1;
            return false;
          }
          return true;
        }
      );
      const clamped = Math.min(cursor, tr.doc.content.size - 1);
      const $cursor = tr.doc.resolve(Math.max(1, clamped));
      tr.setSelection(TextSelection.near($cursor));
      if (dispatch) {
        dispatch(tr);
      }
      return true;
    })
    .run();
}

/** 拖拽手柄当前指向的顶层块（如整块 bulletList），与 posAtCoords 相比位置更可靠 */
const LIST_CONTAINER_TYPES = new Set([
  "bulletList",
  "orderedList",
  "taskList",
]);

export type DragHandleNodePayload = {
  editor: Editor;
  node: PMNode | null;
  pos: number;
};

export function useSlashCommandTrigger(editor: Editor | null) {
  const hoveredBlockRef = useRef<{ node: PMNode; pos: number } | null>(null);

  const onDragHandleNodeChange = useCallback((payload: DragHandleNodePayload) => {
    if (payload.node && payload.pos >= 0) {
      hoveredBlockRef.current = { node: payload.node, pos: payload.pos };
    } else {
      hoveredBlockRef.current = null;
    }
  }, []);

  const handleSlashCommand = useCallback(
    (e: MouseEvent) => {
      if (!editor) return;
      e.preventDefault();

      const hovered = hoveredBlockRef.current;
      if (hovered?.node && LIST_CONTAINER_TYPES.has(hovered.node.type.name)) {
        appendListChildItem(editor, hovered.node, hovered.pos);
        return;
      }

      const buttonRect = e.currentTarget.getBoundingClientRect();
      const editorRect = editor.view.dom.getBoundingClientRect();

      // Use a position inside the editor content area (50px offset from left)
      const posInfo = editor.view.posAtCoords({
        left: editorRect.left + 50,
        top: buttonRect.top + buttonRect.height / 2,
      });

      if (!posInfo || posInfo.pos === undefined) return;

      const $pos = editor.state.doc.resolve(posInfo.pos);
      const isBlockEmpty = $pos.parent.content.size === 0;

      try {
        if (isBlockEmpty) {
          editor.chain().focus(posInfo.pos).run();
        } else {
          const endPos = $pos.end();
          editor.chain().focus(endPos).splitBlock().run();
        }
      } catch {
        editor.chain().focus(posInfo.pos).run();
      }
      editor.commands.insertContent("/");
    },
    [editor]
  );

  return { handleSlashCommand, onDragHandleNodeChange };
}
