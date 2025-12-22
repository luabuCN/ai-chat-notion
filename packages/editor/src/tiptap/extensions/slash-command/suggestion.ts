import { ReactRenderer } from "@tiptap/react";
import { SuggestionOptions } from "@tiptap/suggestion";
import {
  ChartPieIcon,
  CodeIcon,
  DivideIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  LetterTextIcon,
  ListIcon,
  ListOrderedIcon,
  PaperclipIcon,
  ShapesIcon,
  Smile,
  SparklesIcon,
  SquarePlayIcon,
  TableIcon,
  TextQuoteIcon,
} from "lucide-react";
import { SlashCommandNodeAttrs } from "./slash-command";
import SuggestionList, {
  CommandSuggestionItem,
  SuggestionListHandle,
  SuggestionListProps,
} from "./suggestion-list";

type SuggestionType = Omit<
  SuggestionOptions<CommandSuggestionItem, SlashCommandNodeAttrs>,
  "editor"
>;

const list: CommandSuggestionItem[] = [
  {
    id: "text",
    title: "Text",
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
    description: "Create a list with numbering.",
    keywords: ["ordered", "list"],
    icon: ListOrderedIcon,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    id: "blockquote",
    title: "Quote",
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
    description: "Capture a table.",
    keywords: ["table"],
    icon: TableIcon,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertTable().run(),
  },
  {
    id: "mermaid",
    title: "Mermaid",
    description: "Render a mermaid diagram.",
    keywords: ["mermaid", "diagram"],
    icon: ShapesIcon,
    command: () => {},
  },
  {
    id: "chart",
    title: "Chart",
    description: "Render a chart.",
    keywords: ["chart"],
    icon: ChartPieIcon,
    command: () => {},
  },
  {
    id: "youtube",
    title: "Youtube",
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
    description: "Insert an emoji.",
    keywords: ["emoji", "smile", "face"],
    icon: Smile,
    command: () => {},
  },
  {
    id: "divider",
    title: "Divider",
    description: "Create a horizontal divider.",
    keywords: ["divider"],
    icon: DivideIcon,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
];

const withAiList: CommandSuggestionItem[] = [
  {
    id: "aiWriter",
    title: "AI Writer",
    description: "Ask AI with custom prompt.",
    keywords: ["ai"],
    icon: SparklesIcon,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setAiWriter().run();
    },
  },
  ...list,
];

const uploadItems: CommandSuggestionItem[] = [
  {
    id: "image",
    title: "Image",
    description: "Upload an image or embed from URL.",
    keywords: ["image", "picture", "photo", "upload"],
    icon: ImageIcon,
    command: () => {}, // Handled by suggestion-list dialog
  },
  {
    id: "attachment",
    title: "Attachment",
    description: "Upload a file or embed from URL.",
    keywords: ["attachment", "file", "upload", "document"],
    icon: PaperclipIcon,
    command: () => {}, // Handled by suggestion-list dialog
  },
];

const updatePopupPosition = (
  popup: HTMLDivElement,
  clientRect: (() => DOMRect | null) | null
) => {
  if (!clientRect) return;

  const rect = clientRect();
  if (!rect) return;

  const viewportHeight = window.innerHeight;
  const popupHeight = popup.offsetHeight || 320;
  const spaceBelow = viewportHeight - rect.bottom;
  const spaceAbove = rect.top;

  // Determine placement: prefer bottom, flip to top if not enough space
  const placement = spaceBelow >= popupHeight || spaceBelow >= spaceAbove ? "bottom" : "top";

  let top: number;
  if (placement === "bottom") {
    top = rect.bottom + window.scrollY;
  } else {
    top = rect.top + window.scrollY - popupHeight;
  }

  popup.style.position = "absolute";
  popup.style.left = `${rect.left + window.scrollX}px`;
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

      const baseList = ai ? withAiList : list;
      const itemsWithUpload = uploadFile ? [...uploadItems, ...baseList] : baseList;
      return itemsWithUpload.filter(filterFun);
    },
    render: () => {
      let component: ReactRenderer<SuggestionListHandle, SuggestionListProps>;
      let popup: HTMLDivElement | null = null;

      return {
        onStart: (props) => {
          component = new ReactRenderer(SuggestionList, {
            props: { ...props, uploadFile },
            editor: props.editor,
          });

          if (!props.clientRect) {
            return;
          }

          popup = document.createElement("div");
          popup.appendChild(component.element);
          document.body.appendChild(popup);

          updatePopupPosition(popup, props.clientRect);
        },

        onUpdate(props) {
          component.updateProps({ ...props, uploadFile });

          if (!props.clientRect || !popup) {
            return;
          }

          updatePopupPosition(popup, props.clientRect);
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
