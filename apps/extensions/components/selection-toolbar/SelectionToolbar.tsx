import {
  Brain,
  ChevronDown,
  Copy,
  FileText,
  Languages,
  X,
} from "lucide-react";

type SelectionToolbarProps = {
  onClose?: () => void;
};

const iconBtn =
  "inline-flex shrink-0 items-center justify-center rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-500";

export function SelectionToolbar({ onClose }: SelectionToolbarProps) {
  return (
    <div
      aria-label="文本选区快捷操作"
      aria-orientation="horizontal"
      className="flex items-center gap-3 rounded-full border border-gray-100 bg-white px-3 py-2 shadow-lg"
      onMouseDown={(e) => e.preventDefault()}
      role="toolbar"
    >
      <div
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600"
      >
        <Brain className="h-4 w-4" strokeWidth={2} />
      </div>

      <button className={iconBtn} type="button" aria-label="复制">
        <Copy className="h-4 w-4" strokeWidth={2} />
      </button>

      <button className={iconBtn} type="button" aria-label="摘要或笔记">
        <FileText className="h-4 w-4" strokeWidth={2} />
      </button>

      <button className={iconBtn} type="button" aria-label="翻译">
        <span className="flex items-center gap-0.5">
          <Languages className="h-4 w-4" strokeWidth={2} />
          <ChevronDown className="h-3 w-3 opacity-80" strokeWidth={2} />
        </span>
      </button>

      <div aria-hidden className="h-4 w-px shrink-0 bg-gray-200" />

      <button
        className={iconBtn}
        onClick={onClose}
        type="button"
        aria-label="关闭"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
