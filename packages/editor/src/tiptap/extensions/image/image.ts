import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageView } from "./image-view";
import { cn } from "../../../lib/utils";

export const TiptapImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
}).configure({
  allowBase64: false,
  HTMLAttributes: {
    class: cn("rounded border mx-auto"),
  },
});
