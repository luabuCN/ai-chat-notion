import { Trash2 } from "lucide-react";
import {
  HIGHLIGHT_COLORS,
  type HighlightColor,
  changeHighlightColor,
  removeHighlight,
} from "@/lib/highlight-manager";

type HighlightPopoverProps = {
  highlightId: string;
  currentColor: HighlightColor;
  position: { left: number; top: number };
  onClose: () => void;
};

const COLOR_ENTRIES = Object.entries(HIGHLIGHT_COLORS) as [
  HighlightColor,
  (typeof HIGHLIGHT_COLORS)[HighlightColor],
][];

export function HighlightPopover({
  highlightId,
  currentColor,
  position,
  onClose,
}: HighlightPopoverProps) {
  return (
    <div
      className="pointer-events-auto"
      style={{
        position: "fixed",
        left: position.left,
        top: position.top,
        transform: "translateX(-50%)",
        zIndex: 2_147_483_647,
      }}
    >
      <div
        className="flex items-center gap-[6px] rounded-full border border-gray-100 bg-white px-[10px] py-[6px] shadow-md"
        onMouseDown={(e) => e.preventDefault()}
      >
        {COLOR_ENTRIES.map(([key, value]) => (
          <button
            key={key}
            aria-label={value.label}
            className="size-[20px] shrink-0 rounded-full cursor-pointer border-2 transition-transform hover:scale-110"
            onClick={() => {
              changeHighlightColor(highlightId, key);
              onClose();
            }}
            style={{
              backgroundColor: value.dot,
              borderColor: key === currentColor ? "#94a3b8" : "transparent",
            }}
            type="button"
          />
        ))}

        <div className="mx-[2px] h-[14px] w-px bg-gray-200" />

        <button
          aria-label="删除高亮"
          className="flex size-[22px] items-center justify-center rounded-md text-slate-500 hover:text-red-500 cursor-pointer transition-colors"
          onClick={() => {
            removeHighlight(highlightId);
            onClose();
          }}
          type="button"
        >
          <Trash2 className="size-[14px]!" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
