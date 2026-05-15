import {
  ClipboardPaste,
  FileSearch,
  Redo2,
  Save,
  Search,
  Sparkles,
  Undo2,
  type LucideIcon,
} from "lucide-react";

export const EDITOR_SHORTCUT_KBD_CLASS =
  "inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md border border-border bg-muted px-1.5 font-mono text-[11px] font-medium text-foreground shadow-sm";

type KbdKey = { type: "key"; label: string };
type KbdPlus = { type: "plus" };
export type KbdSegment = KbdKey | KbdPlus;

export type EditorShortcutDef =
  | {
      id: string;
      icon: LucideIcon;
      label: string;
      keys: readonly KbdSegment[];
    }
  | {
      id: string;
      icon: LucideIcon;
      label: string;
      alternativeKeys: readonly [readonly KbdSegment[], readonly KbdSegment[]];
    };

/** 编辑器页快捷键说明列表（与 `useEditorPageShortcuts` 中 Cmd/Ctrl+S、Cmd/Ctrl+K 等行为一致处对应） */
export const EDITOR_SHORTCUT_ITEMS: readonly EditorShortcutDef[] = [
  {
    id: "undo",
    icon: Undo2,
    label: "撤销",
    keys: [
      { type: "key", label: "Cmd/Ctrl" },
      { type: "plus" },
      { type: "key", label: "Z" },
    ],
  },
  {
    id: "redo",
    icon: Redo2,
    label: "重做",
    alternativeKeys: [
      [
        { type: "key", label: "Shift" },
        { type: "key", label: "Cmd/Ctrl" },
        { type: "key", label: "Z" },
      ],
      [
        { type: "key", label: "Ctrl" },
        { type: "plus" },
        { type: "key", label: "Y" },
      ],
    ],
  },
  {
    id: "save",
    icon: Save,
    label: "保存",
    keys: [
      { type: "key", label: "Cmd/Ctrl" },
      { type: "plus" },
      { type: "key", label: "S" },
    ],
  },
  {
    id: "paste",
    icon: ClipboardPaste,
    label: "粘贴",
    keys: [
      { type: "key", label: "Cmd/Ctrl" },
      { type: "plus" },
      { type: "key", label: "V" },
    ],
  },
  {
    id: "ai-chat",
    icon: Sparkles,
    label: "打开 AI 对话",
    keys: [{ type: "key", label: "Space" }],
  },
  {
    id: "doc-search",
    icon: FileSearch,
    label: "打开文档搜索",
    keys: [
      { type: "key", label: "Cmd/Ctrl" },
      { type: "plus" },
      { type: "key", label: "K" },
    ],
  },
  {
    id: "find-replace",
    icon: Search,
    label: "查找和替换",
    keys: [
      { type: "key", label: "Cmd/Ctrl" },
      { type: "plus" },
      { type: "key", label: "F" },
    ],
  },
];

export function EditorShortcutKeyboardRow({
  segments,
}: {
  segments: readonly KbdSegment[];
}) {
  return (
    <span className="flex flex-wrap items-center justify-end gap-1">
      {segments.map((segment, segmentIndex) => {
        if (segment.type === "plus") {
          return (
            <span
              key={`plus-${segmentIndex.toString()}`}
              className="text-muted-foreground"
            >
              +
            </span>
          );
        }
        return (
          <kbd
            key={`${segment.label}-${segmentIndex.toString()}`}
            className={EDITOR_SHORTCUT_KBD_CLASS}
          >
            {segment.label}
          </kbd>
        );
      })}
    </span>
  );
}

export function EditorShortcutKeysCell({ item }: { item: EditorShortcutDef }) {
  if ("alternativeKeys" in item) {
    const [first, second] = item.alternativeKeys;
    return (
      <span className="flex flex-col items-end gap-1 sm:flex-row sm:flex-wrap sm:items-center">
        <EditorShortcutKeyboardRow segments={first} />
        <span className="hidden text-muted-foreground sm:inline">/</span>
        <EditorShortcutKeyboardRow segments={second} />
      </span>
    );
  }
  return <EditorShortcutKeyboardRow segments={item.keys} />;
}
