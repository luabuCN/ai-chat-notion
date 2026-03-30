import { Node, mergeAttributes } from "@tiptap/core";

export const TIPTAP_INSERT_DOCUMENT_LINK = "tiptap-insert-document-link";

function getDocumentHref(targetId: string): string {
  const segments = window.location.pathname.split("/");
  const editorIdx = segments.indexOf("editor");
  if (editorIdx >= 0) {
    return segments.slice(0, editorIdx + 1).join("/") + "/" + targetId;
  }
  return "/editor/" + targetId;
}

export type InsertDocumentLinkDetail = {
  onSelect: (doc: { id: string; title: string; icon?: string | null }) => void;
};

export interface DocumentLinkOptions {
  navigate: ((href: string) => void) | null;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    documentLink: {
      setDocumentLink: (attrs: {
        documentId: string;
        documentTitle: string;
        documentIcon?: string | null;
      }) => ReturnType;
    };
  }
}

export const DocumentLink = Node.create<DocumentLinkOptions>({
  name: "documentLink",
  group: "inline",
  inline: true,
  atom: true,

  addOptions() {
    return {
      navigate: null,
    };
  },

  addAttributes() {
    return {
      documentId: { default: null },
      documentTitle: { default: "未命名" },
      documentIcon: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-document-link]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-document-link": HTMLAttributes.documentId,
        class: "document-link-node",
      }),
      HTMLAttributes.documentIcon
        ? `${HTMLAttributes.documentIcon} ${HTMLAttributes.documentTitle}`
        : `📄 ${HTMLAttributes.documentTitle}`,
    ];
  },

  addCommands() {
    return {
      setDocumentLink:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent([
              { type: this.name, attrs },
              { type: "text", text: " " },
            ])
            .run(),
    };
  },

  addNodeView() {
    const navigate = this.options.navigate;

    return ({ node }) => {
      const { documentId, documentTitle, documentIcon } = node.attrs as {
        documentId: string;
        documentTitle: string;
        documentIcon: string | null;
      };

      const wrapper = document.createElement("a");
      wrapper.href = getDocumentHref(documentId);
      wrapper.className =
        "inline-flex items-center gap-1 px-1 py-px -my-px mx-px rounded " +
        "bg-accent/60 hover:bg-accent text-foreground " +
        "cursor-pointer transition-colors no-underline " +
        "select-none align-baseline leading-normal";
      wrapper.contentEditable = "false";
      wrapper.setAttribute("data-document-link", documentId);

      const iconSpan = document.createElement("span");
      iconSpan.className = "text-[0.9em] leading-none shrink-0 opacity-70";
      iconSpan.textContent = documentIcon || "📄";

      const titleSpan = document.createElement("span");
      titleSpan.className =
        "text-[0.95em] underline underline-offset-2 decoration-primary/50 " +
        "hover:decoration-primary font-medium";
      titleSpan.textContent = documentTitle || "未命名";

      wrapper.appendChild(iconSpan);
      wrapper.appendChild(titleSpan);

      wrapper.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const href = getDocumentHref(documentId);
        if (navigate) {
          navigate(href);
        } else {
          window.location.href = href;
        }
      });

      return {
        dom: wrapper,
        update(updatedNode) {
          if (updatedNode.type.name !== "documentLink") return false;
          const attrs = updatedNode.attrs as {
            documentId: string;
            documentTitle: string;
            documentIcon: string | null;
          };
          wrapper.href = getDocumentHref(attrs.documentId);
          wrapper.setAttribute("data-document-link", attrs.documentId);
          iconSpan.textContent = attrs.documentIcon || "📄";
          titleSpan.textContent = attrs.documentTitle || "未命名";
          return true;
        },
      };
    };
  },
});
