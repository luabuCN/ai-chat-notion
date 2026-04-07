import {
  Avatar,
  AvatarFallback,
  Button,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui";
import {
  Brain,
  ChevronDown,
  Copy,
  FileText,
  Languages,
  X,
  type LucideIcon,
} from "lucide-react";

type SelectionToolbarProps = {
  onClose?: () => void;
  /** 点击 AI 助手按钮时触发，参数为当前选中文本 */
  onAiClick?: (selectedText: string) => void | Promise<void>;
};

type ToolbarActionItem =
  | {
      key: "ai";
      ariaLabel: string;
      tooltip: string;
      variant: "avatar";
    }
  | {
      key: "copy" | "explain";
      ariaLabel: string;
      tooltip: string;
      variant: "icon";
      Icon: LucideIcon;
    }
  | {
      key: "translate";
      ariaLabel: string;
      tooltip: string;
      variant: "translate";
    };

const TOOLBAR_ACTION_ITEMS: ToolbarActionItem[] = [
  { key: "ai", ariaLabel: "AI 助手", tooltip: "AI 助手", variant: "avatar" },
  {
    key: "copy",
    ariaLabel: "复制",
    tooltip: "复制",
    variant: "icon",
    Icon: Copy,
  },
  {
    key: "explain",
    ariaLabel: "解释",
    tooltip: "解释",
    variant: "icon",
    Icon: FileText,
  },
  {
    key: "translate",
    ariaLabel: "翻译",
    tooltip: "翻译",
    variant: "translate",
  },
];

/** 固定 px；ghost 会带 hover 背景，这里改为透明 + 仅主题色变化 */
const iconButtonClassName =
  "box-border h-[26px] w-[26px] shrink-0 rounded-lg p-0 text-slate-600 hover:bg-transparent hover:text-primary active:bg-transparent active:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer";

const tooltipSurfaceClassName =
  "border-slate-200 bg-white text-slate-900 shadow-md";

const aiAvatarButtonClassName =
  "group inline-flex size-[26px] items-center justify-center rounded-full bg-transparent outline-none hover:bg-transparent active:bg-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer";

export function SelectionToolbar({ onClose, onAiClick }: SelectionToolbarProps) {
  const getSelectedText = (): string => globalThis.getSelection?.()?.toString() ?? "";

  const onActionClick = (actionKey: ToolbarActionItem["key"]) => {
    const selectedText = getSelectedText();
    if (actionKey === "ai") {
      onAiClick?.(selectedText);
      return;
    }
    // 临时调试：点击按钮时打印当前选区文本
    // biome-ignore lint/suspicious/noConsole: 用户要求点击时打印选中文本
    console.log("[SelectionToolbar] selected text:", { actionKey, selectedText });
  };

  return (
    <div
      aria-label="文本选区快捷操作"
      aria-orientation="horizontal"
      className="box-border flex h-[36px] items-center gap-[8px] rounded-full border border-gray-100 bg-white px-[10px] py-0 shadow-sm"
      onMouseDown={(e) => e.preventDefault()}
      role="toolbar"
    >
      {TOOLBAR_ACTION_ITEMS.map((item) => (
        <Tooltip key={item.key}>
          <TooltipTrigger asChild>
            {item.variant === "avatar" ? (
              <button
                aria-label={item.ariaLabel}
                className={aiAvatarButtonClassName}
                onClick={() => onActionClick(item.key)}
                type="button"
              >
                <Avatar className="size-[26px]!">
                  <AvatarFallback className="bg-primary/10 text-slate-600 group-hover:text-primary group-active:text-primary">
                    <Brain className="size-[16px]!" strokeWidth={2} />
                  </AvatarFallback>
                </Avatar>
              </button>
            ) : item.variant === "icon" ? (
              <Button
                aria-label={item.ariaLabel}
                className={iconButtonClassName}
                onClick={() => onActionClick(item.key)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <item.Icon className="size-[16px]!" strokeWidth={2} />
              </Button>
            ) : (
              <Button
                aria-label={item.ariaLabel}
                className={iconButtonClassName}
                onClick={() => onActionClick(item.key)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <span className="flex items-center gap-[2px]">
                  <Languages className="size-[16px]!" strokeWidth={2} />
                  <ChevronDown
                    className="size-[12px]! opacity-80"
                    strokeWidth={2}
                  />
                </span>
              </Button>
            )}
          </TooltipTrigger>
          <TooltipContent className={tooltipSurfaceClassName} side="top">
            {item.tooltip}
          </TooltipContent>
        </Tooltip>
      ))}

      <Separator className="h-[14px]! w-px bg-gray-200" orientation="vertical" />

      <Button
        aria-label="关闭"
        className={iconButtonClassName}
        onClick={onClose}
        size="icon"
        type="button"
        variant="ghost"
      >
        <X className="size-[16px]!" strokeWidth={2} />
      </Button>
    </div>
  );
}
