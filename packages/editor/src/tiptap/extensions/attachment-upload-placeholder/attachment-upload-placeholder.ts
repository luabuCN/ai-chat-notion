import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { AttachmentUploadPlaceholderView } from "./attachment-upload-placeholder-view";

export interface AttachmentUploadPlaceholderOptions {
  HTMLAttributes: Record<string, unknown>;
  uploadFile?: (file: File) => Promise<string>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    attachmentUploadPlaceholder: {
      setAttachmentUploadPlaceholder: () => ReturnType;
    };
  }
}

export const AttachmentUploadPlaceholder =
  Node.create<AttachmentUploadPlaceholderOptions>({
    name: "attachmentUploadPlaceholder",

    group: "block",

    atom: true,

    draggable: true,

    addOptions() {
      return {
        HTMLAttributes: {},
        uploadFile: undefined,
      };
    },

    parseHTML() {
      return [
        {
          tag: 'div[data-type="attachment-upload-placeholder"]',
        },
      ];
    },

    renderHTML({ HTMLAttributes }) {
      return [
        "div",
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
          "data-type": "attachment-upload-placeholder",
        }),
      ];
    },

    addNodeView() {
      return ReactNodeViewRenderer(AttachmentUploadPlaceholderView);
    },

    addCommands() {
      return {
        setAttachmentUploadPlaceholder:
          () =>
          ({ commands }) => {
            return commands.insertContent({
              type: this.name,
            });
          },
      };
    },
  });
