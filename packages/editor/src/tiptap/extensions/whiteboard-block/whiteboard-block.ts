import { mergeAttributes, Node } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import type * as Y from "yjs";
import { removeBlockState } from "@repo/whiteboard";
import { WhiteboardBlockView } from "./whiteboard-block-view";

export interface WhiteboardBlockOptions {
  HTMLAttributes: Record<string, unknown>;
  ydoc: Y.Doc | null;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    whiteboardBlock: {
      insertWhiteboardBlock: () => ReturnType;
    };
  }
}

const whiteboardGcKey = new PluginKey("whiteboard-block-gc");

function collectWhiteboardBlockIds(doc: {
  descendants: (
    fn: (node: { type: { name: string }; attrs: { id?: string | null } }) => void
  ) => void;
}): Set<string> {
  const ids = new Set<string>();
  doc.descendants((node) => {
    if (node.type.name === "whiteboardBlock" && node.attrs.id) {
      ids.add(String(node.attrs.id));
    }
  });
  return ids;
}

export const WhiteboardBlock = Node.create<WhiteboardBlockOptions>({
  name: "whiteboardBlock",
  group: "block",
  atom: true,
  draggable: true,
  allowGapCursor: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      ydoc: null,
    };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-block-id"),
        renderHTML: (attributes) => {
          if (!attributes.id) {
            return {};
          }
          return { "data-block-id": attributes.id };
        },
      },
      "data-content-type": {
        default: "whiteboardBlock",
      },
    };
  },

  addCommands() {
    return {
      insertWhiteboardBlock:
        () =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name });
        },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-content-type="whiteboardBlock"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: "whiteboard-block my-4 w-full min-h-[360px]",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(WhiteboardBlockView, {
      attrs: {
        contentEditable: "false",
      },
    });
  },

  addProseMirrorPlugins() {
    const ydoc = this.options.ydoc;
    if (!ydoc) {
      return [];
    }

    return [
      new Plugin({
        key: whiteboardGcKey,
        appendTransaction: (transactions, oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) {
            return null;
          }
          const before = collectWhiteboardBlockIds(oldState.doc);
          const after = collectWhiteboardBlockIds(newState.doc);
          for (const id of before) {
            if (!after.has(id)) {
              removeBlockState(ydoc, id);
            }
          }
          return null;
        },
      }),
    ];
  },
});
