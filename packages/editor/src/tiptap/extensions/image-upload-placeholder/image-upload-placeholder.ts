import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageUploadPlaceholderView } from "./image-upload-placeholder-view";

export interface ImageUploadPlaceholderOptions {
  HTMLAttributes: Record<string, unknown>;
  uploadFile?: (file: File) => Promise<string>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imageUploadPlaceholder: {
      setImageUploadPlaceholder: () => ReturnType;
    };
  }
}

export const ImageUploadPlaceholder =
  Node.create<ImageUploadPlaceholderOptions>({
    name: "imageUploadPlaceholder",

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
          tag: 'div[data-type="image-upload-placeholder"]',
        },
      ];
    },

    renderHTML({ HTMLAttributes }) {
      return [
        "div",
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
          "data-type": "image-upload-placeholder",
        }),
      ];
    },

    addNodeView() {
      return ReactNodeViewRenderer(ImageUploadPlaceholderView);
    },

    addCommands() {
      return {
        setImageUploadPlaceholder:
          () =>
          ({ commands }) => {
            return commands.insertContent({
              type: this.name,
            });
          },
      };
    },
  });
