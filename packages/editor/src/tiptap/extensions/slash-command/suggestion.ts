import { ReactRenderer } from "@tiptap/react";
import { SuggestionOptions } from "@tiptap/suggestion";
import {
  ChartPieIcon,
  CodeIcon,
  DivideIcon,
  FileTextIcon,
  FolderOpenIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  LetterTextIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  PaperclipIcon,
  ShapesIcon,
  Smile,
  SquarePlayIcon,
  TableIcon,
  TextQuoteIcon,
} from "lucide-react";
import { SlashCommandNodeAttrs } from "./slash-command";
import {
  TIPTAP_INSERT_DOCUMENT_LINK,
  type InsertDocumentLinkDetail,
} from "../document-link";
import SuggestionList, {
  CommandSuggestionItem,
  SuggestionListHandle,
  SuggestionListProps,
} from "./suggestion-list";

type SuggestionType = Omit<
  SuggestionOptions<CommandSuggestionItem, SlashCommandNodeAttrs>,
  "editor"
>;

export const EDITOR_SELECT_FROM_MATERIAL_LIBRARY =
  "editor:selectFromMaterialLibrary";

export type MaterialLibrarySelectDetail = {
  onSelect: (url: string) => void;
};

const formatItems: CommandSuggestionItem[] = [
  {
    id: "text",
    title: "Text",
    category: "format",
    description: "Just start typing with plain text.",
    keywords: ["p", "paragraph"],
    icon: LetterTextIcon,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleNode("paragraph", "paragraph")
        .run();
    },
  },
  {
    id: "h1",
    title: "Heading 1",
    category: "format",
    description: "Big section heading.",
    keywords: ["title", "big", "large", "heading"],
    icon: Heading1Icon,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 1 })
        .run();
    },
  },
  {
    id: "h2",
    title: "Heading 2",
    category: "format",
    description: "Medium section heading.",
    keywords: ["subtitle", "medium", "heading"],
    icon: Heading2Icon,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 2 })
        .run();
    },
  },
  {
    id: "h3",
    title: "Heading 3",
    category: "format",
    description: "Small section heading.",
    keywords: ["subtitle", "small", "heading"],
    icon: Heading3Icon,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 3 })
        .run();
    },
  },
  {
    id: "ul",
    title: "Bullet List",
    category: "format",
    description: "Create a simple bullet list.",
    keywords: ["unordered", "list", "bullet"],
    icon: ListIcon,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    id: "ol",
    title: "Numbered List",
    category: "format",
    description: "Create a list with numbering.",
    keywords: ["ordered", "list"],
    icon: ListOrderedIcon,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    id: "taskList",
    title: "待办清单",
    category: "format",
    description: "Create a to-do list with checkboxes.",
    keywords: ["todo", "task", "checkbox", "待办", "清单", "任务", "checklist"],
    icon: ListTodoIcon,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    id: "blockquote",
    title: "Quote",
    category: "format",
    description: "Capture a quote.",
    keywords: ["blockquote"],
    icon: TextQuoteIcon,
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleNode("paragraph", "paragraph")
        .toggleBlockquote()
        .run(),
  },
  {
    id: "codeBlock",
    title: "Code",
    category: "format",
    description: "Capture a code snippet.",
    keywords: ["codeblock"],
    icon: CodeIcon,
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleCodeBlock({ language: "plaintext" })
        .run(),
  },
  {
    id: "table",
    title: "Table",
    category: "format",
    description: "Capture a table.",
    keywords: ["table"],
    icon: TableIcon,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertTable().run(),
  },
  {
    id: "mermaid",
    title: "Mermaid",
    category: "format",
    description: "Render a mermaid diagram.",
    keywords: ["mermaid", "diagram"],
    icon: ShapesIcon,
    command: () => {},
  },
  {
    id: "chart",
    title: "Chart",
    category: "format",
    description: "Render a chart.",
    keywords: ["chart"],
    icon: ChartPieIcon,
    command: () => {},
  },
  {
    id: "divider",
    title: "Divider",
    category: "format",
    description: "Create a horizontal divider.",
    keywords: ["divider"],
    icon: DivideIcon,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
];

const insertItems: CommandSuggestionItem[] = [
  {
    id: "youtube",
    title: "Youtube",
    category: "insert",
    description: "Embed a Youtube video.",
    keywords: ["youtube"],
    icon: SquarePlayIcon,
    command: ({ editor, range }) => {
      const videoLink = prompt("Please enter Youtube Video Link");
      //From https://regexr.com/3dj5t
      const ytregex = new RegExp(
        /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w-]+\?v=|embed\/|v\/)?)([\w-]+)(\S+)?$/
      );

      if (videoLink && ytregex.test(videoLink)) {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setYoutubeVideo({
            src: videoLink,
          })
          .run();
      } else {
        if (videoLink !== null) {
          alert("Please enter a correct Youtube Video Link");
        }
      }
    },
  },
  {
    id: "emoji",
    title: "Emoji",
    category: "insert",
    description: "Insert an emoji.",
    keywords: ["emoji", "smile", "face"],
    icon: Smile,
    command: () => {},
  },
];

const materialLibraryItem: CommandSuggestionItem = {
  id: "materialLibrary",
  title: "插入图片从素材库",
  description: "从当前空间 AI 生成的历史图片中选择插入。",
  keywords: ["素材", "素材库", "历史", "图片"],
  category: null,
  icon: FolderOpenIcon,
  command: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).run();
    window.dispatchEvent(
      new CustomEvent(EDITOR_SELECT_FROM_MATERIAL_LIBRARY, {
        detail: {
          onSelect: (url: string) => {
            editor.chain().focus().setImage({ src: url }).run();
          },
        },
      })
    );
  },
};

const documentLinkItem: CommandSuggestionItem = {
  id: "documentLink",
  title: "插入文档链接",
  description: "引用工作空间中的其他文档，点击可跳转。",
  keywords: ["文档", "链接", "引用", "document", "link", "page"],
  category: null,
  icon: FileTextIcon,
  command: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).run();
    window.dispatchEvent(
      new CustomEvent<InsertDocumentLinkDetail>(TIPTAP_INSERT_DOCUMENT_LINK, {
        detail: {
          onSelect: (doc) => {
            editor
              .chain()
              .focus()
              .setDocumentLink({
                documentId: doc.id,
                documentTitle: doc.title,
                documentIcon: doc.icon,
              })
              .run();
          },
        },
      })
    );
  },
};

const uploadItems: CommandSuggestionItem[] = [
  {
    id: "image",
    title: "Image",
    category: "insert",
    description: "Upload an image or embed from URL.",
    keywords: ["image", "picture", "photo", "upload"],
    icon: ImageIcon,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setImageUploadPlaceholder()
        .run();
    },
  },
  {
    id: "attachment",
    title: "Attachment",
    category: "insert",
    description: "Upload a file or embed from URL.",
    keywords: ["attachment", "file", "upload", "document"],
    icon: PaperclipIcon,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setAttachmentUploadPlaceholder()
        .run();
    },
  },
];

const POPUP_VIEWPORT_PADDING = 8;
const POPUP_GAP = 4;
const POPUP_FALLBACK_HEIGHT = 320;
const EDITOR_SCROLL_CONTAINER_ID = "editor-scroll-container";

type EditorScrollLock = {
  unlock: () => void;
};

/**
 * 菜单打开时锁定正文滚动位置。
 * 不改 overflow（避免滚动条消失导致整页左右抖），只拦截滚轮/触摸并把 scrollTop 钉住。
 */
const lockEditorScroll = (): EditorScrollLock | null => {
  const el = document.getElementById(EDITOR_SCROLL_CONTAINER_ID);
  if (!el) {
    return null;
  }

  const lockedScrollTop = el.scrollTop;

  const preventWheelTouch = (event: Event) => {
    event.preventDefault();
  };

  const pinScrollTop = () => {
    if (el.scrollTop !== lockedScrollTop) {
      el.scrollTop = lockedScrollTop;
    }
  };

  const preventScrollKeys = (event: KeyboardEvent) => {
    // 仅拦截会滚动视口的键；Space 留给编辑器输入/过滤
    if (
      event.key === "PageUp" ||
      event.key === "PageDown" ||
      event.key === "Home" ||
      event.key === "End"
    ) {
      event.preventDefault();
    }
  };

  el.addEventListener("wheel", preventWheelTouch, { passive: false });
  el.addEventListener("touchmove", preventWheelTouch, { passive: false });
  el.addEventListener("scroll", pinScrollTop);
  document.addEventListener("keydown", preventScrollKeys, true);

  return {
    unlock: () => {
      el.removeEventListener("wheel", preventWheelTouch);
      el.removeEventListener("touchmove", preventWheelTouch);
      el.removeEventListener("scroll", pinScrollTop);
      document.removeEventListener("keydown", preventScrollKeys, true);
    },
  };
};

const updatePopupPosition = (
  popup: HTMLDivElement,
  clientRect: (() => DOMRect | null) | null
) => {
  if (!clientRect) return;

  const rect = clientRect();
  if (!rect) return;

  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  // 正文在内部滚动容器里，必须用 fixed + 视口坐标；不要混用 absolute/window.scrollY
  const measuredHeight = popup.offsetHeight;
  const popupHeight =
    measuredHeight > 0 ? measuredHeight : POPUP_FALLBACK_HEIGHT;
  const popupWidth = popup.offsetWidth || 288;
  const spaceBelow = viewportHeight - rect.bottom - POPUP_VIEWPORT_PADDING;
  const spaceAbove = rect.top - POPUP_VIEWPORT_PADDING;

  let placement: "bottom" | "top" = "bottom";
  if (spaceBelow < popupHeight && spaceAbove > spaceBelow) {
    placement = "top";
  }

  // 按可用空间限制菜单高度，避免为塞进视口而远离光标
  const availableSpace =
    placement === "bottom"
      ? Math.max(spaceBelow - POPUP_GAP, 120)
      : Math.max(spaceAbove - POPUP_GAP, 120);
  const maxMenuHeight = Math.min(POPUP_FALLBACK_HEIGHT, availableSpace);
  popup.style.maxHeight = `${maxMenuHeight}px`;
  popup.style.overflow = "hidden";
  const menuRoot = popup.firstElementChild;
  if (menuRoot instanceof HTMLElement) {
    menuRoot.style.maxHeight = `${maxMenuHeight}px`;
  }

  const heightForPlace = Math.min(
    measuredHeight > 0 ? measuredHeight : POPUP_FALLBACK_HEIGHT,
    availableSpace
  );

  let top =
    placement === "bottom"
      ? rect.bottom + POPUP_GAP
      : rect.top - heightForPlace - POPUP_GAP;

  top = Math.min(
    Math.max(top, POPUP_VIEWPORT_PADDING),
    viewportHeight - POPUP_VIEWPORT_PADDING - Math.min(heightForPlace, availableSpace)
  );

  let left = rect.left;
  left = Math.min(
    Math.max(left, POPUP_VIEWPORT_PADDING),
    viewportWidth - popupWidth - POPUP_VIEWPORT_PADDING
  );

  popup.style.position = "fixed";
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
  popup.style.zIndex = "50";
};

const getSuggestion = ({
  ai,
  uploadFile,
}: {
  ai?: boolean;
  uploadFile?: (file: File) => Promise<string>;
}): SuggestionType => {
  return {
    items: ({ query }) => {
      const filterFun = (item: CommandSuggestionItem) => {
        return item.keywords.some((k) => k.startsWith(query.toLowerCase()));
      };

      const items = ai
        ? uploadFile
          ? [materialLibraryItem, documentLinkItem, ...formatItems, ...uploadItems, ...insertItems]
          : [materialLibraryItem, documentLinkItem, ...formatItems, ...insertItems]
        : uploadFile
          ? [documentLinkItem, ...formatItems, ...uploadItems, ...insertItems]
          : [documentLinkItem, ...formatItems, ...insertItems];
      return items.filter(filterFun);
    },
    render: () => {
      let component: ReactRenderer<SuggestionListHandle, SuggestionListProps>;
      let popup: HTMLDivElement | null = null;
      let scrollLock: EditorScrollLock | null = null;

      return {
        onStart: (props) => {
          component = new ReactRenderer(SuggestionList, {
            props: { ...props, uploadFile },
            editor: props.editor,
          });

          if (!props.clientRect) {
            return;
          }

          scrollLock = lockEditorScroll();

          popup = document.createElement("div");
          popup.appendChild(component.element);
          document.body.appendChild(popup);

          updatePopupPosition(popup, props.clientRect);
          // 首帧菜单高度可能尚未算准，下一帧按真实高度再翻转到上方
          requestAnimationFrame(() => {
            if (popup) {
              updatePopupPosition(popup, props.clientRect);
            }
          });
        },

        onUpdate(props) {
          component.updateProps({ ...props, uploadFile });

          if (!props.clientRect || !popup) {
            return;
          }

          updatePopupPosition(popup, props.clientRect);
          requestAnimationFrame(() => {
            if (popup) {
              updatePopupPosition(popup, props.clientRect);
            }
          });
        },

        onKeyDown(props) {
          if (props.event.key === "Escape") {
            if (popup) {
              popup.style.display = "none";
            }
            return true;
          }

          return component.ref?.onKeyDown(props) ?? false;
        },

        onExit() {
          scrollLock?.unlock();
          scrollLock = null;
          if (popup) {
            popup.remove();
            popup = null;
          }
          component?.destroy();
        },
      };
    },
  };
};

export { getSuggestion };
