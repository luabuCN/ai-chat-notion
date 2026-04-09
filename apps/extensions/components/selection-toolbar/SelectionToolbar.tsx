import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui";
import {
  Brain,
  Check,
  ChevronDown,
  Copy,
  FileText,
  Highlighter,
  Languages,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useExtensionPortalContainer } from "@/lib/extension-portal-context";
import {
  DEFAULT_TRANSLATION_LANGUAGE_ID,
  TRANSLATION_LANGUAGES,
} from "@/lib/translation-languages";

type SelectionToolbarProps = {
  onClose?: () => void;
  /** 点击 AI 助手按钮时触发，参数为当前选中文本 */
  onAiClick?: (selectedText: string) => void | Promise<void>;
  /** 点击解释时触发（与 AI 相同鉴权，但直接进入回答流，问题固定为「解释」） */
  onExplainClick?: (selectedText: string) => void | Promise<void>;
  /** 从翻译菜单选择目标语言后触发 */
  onTranslateLanguage?: (
    selectedText: string,
    languageId: string,
  ) => void | Promise<void>;
  /** 点击高亮按钮时触发 */
  onHighlight?: () => void;
};

type ToolbarActionItem =
  | {
      key: "ai";
      ariaLabel: string;
      tooltip: string;
      variant: "avatar";
    }
  | {
      key: "copy" | "highlight" | "explain";
      ariaLabel: string;
      tooltip: string;
      variant: "icon";
      Icon: LucideIcon;
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
    key: "highlight",
    ariaLabel: "高亮",
    tooltip: "高亮",
    variant: "icon",
    Icon: Highlighter,
  },
  {
    key: "explain",
    ariaLabel: "解释",
    tooltip: "解释",
    variant: "icon",
    Icon: FileText,
  },
];

/** 固定 px；ghost 会带 hover 背景，这里改为透明 + 仅主题色变化 */
const iconButtonClassName =
  "box-border h-[26px] w-[26px] shrink-0 rounded-lg p-0 text-slate-600 hover:bg-transparent hover:text-primary active:bg-transparent active:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer";

const tooltipSurfaceClassName =
  "border-slate-200 bg-white text-slate-900 shadow-md";

const aiAvatarButtonClassName =
  "group inline-flex size-[26px] items-center justify-center rounded-full bg-transparent outline-none hover:bg-transparent active:bg-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer";

const COPY_FEEDBACK_MS = 1500;

export function SelectionToolbar({
  onClose,
  onAiClick,
  onExplainClick,
  onTranslateLanguage,
  onHighlight,
}: SelectionToolbarProps) {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const extensionMenuPortalHost = useExtensionPortalContainer();

  const getSelectedText = (): string => globalThis.getSelection?.()?.toString() ?? "";

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard API 不可用时静默失败 */
    }
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  }, []);

  const onActionClick = (actionKey: ToolbarActionItem["key"]) => {
    const selectedText = getSelectedText();
    if (actionKey === "ai") {
      onAiClick?.(selectedText);
      return;
    }
    if (actionKey === "copy") {
      void handleCopy(selectedText);
      return;
    }
    if (actionKey === "highlight") {
      onHighlight?.();
      return;
    }
    if (actionKey === "explain") {
      void onExplainClick?.(selectedText);
      return;
    }
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
            ) : (
              <Button
                aria-label={copied && item.key === "copy" ? "已复制" : item.ariaLabel}
                className={iconButtonClassName}
                onClick={() => onActionClick(item.key)}
                size="icon"
                type="button"
                variant="ghost"
              >
                {copied && item.key === "copy" ? (
                  <Check className="size-[16px]! text-green-500" strokeWidth={2} />
                ) : (
                  <item.Icon className="size-[16px]!" strokeWidth={2} />
                )}
              </Button>
            )}
          </TooltipTrigger>
          <TooltipContent className={tooltipSurfaceClassName} side="top">
            {copied && item.key === "copy" ? "已复制" : item.tooltip}
          </TooltipContent>
        </Tooltip>
      ))}

      <div className="inline-flex h-[26px] items-stretch overflow-hidden rounded-lg border border-slate-200/60 bg-white">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label="翻译为英语"
              className="box-border flex h-full w-[26px] shrink-0 items-center justify-center rounded-none border-r border-slate-200/60 bg-white p-0 text-slate-600 outline-none hover:bg-slate-50 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={() => {
                const selectedText = getSelectedText();
                void onTranslateLanguage?.(
                  selectedText,
                  DEFAULT_TRANSLATION_LANGUAGE_ID,
                );
              }}
              type="button"
            >
              <Languages className="size-[16px]!" strokeWidth={2} />
            </button>
          </TooltipTrigger>
          <TooltipContent className={tooltipSurfaceClassName} side="top">
            翻译为英语（默认）
          </TooltipContent>
        </Tooltip>
        <DropdownMenu modal={false}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  aria-haspopup="menu"
                  aria-label="选择翻译语言"
                  className="box-border flex h-full w-[22px] shrink-0 items-center justify-center rounded-none bg-white p-0 text-slate-600 outline-none hover:bg-slate-50 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  type="button"
                >
                  <ChevronDown className="size-[12px]! opacity-80" strokeWidth={2} />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent className={tooltipSurfaceClassName} side="top">
              选择语言
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            align="center"
            className="z-[2147483647] max-h-[min(320px,calc(100vh-96px))] w-[min(100vw-24px,280px)] overflow-y-auto border-slate-200 bg-white p-1 text-slate-900 shadow-md"
            container={extensionMenuPortalHost}
            onCloseAutoFocus={(e) => e.preventDefault()}
            side="top"
            sideOffset={8}
          >
            {TRANSLATION_LANGUAGES.map((lang) => (
              <DropdownMenuItem
                className="cursor-pointer flex-col items-start gap-0.5 py-2"
                key={lang.id}
                onSelect={() => {
                  const selectedText = getSelectedText();
                  void onTranslateLanguage?.(selectedText, lang.id);
                }}
              >
                <span className="w-full font-medium leading-tight">{lang.labelZh}</span>
                <span className="w-full text-[12px] leading-tight text-slate-500">
                  {lang.nativeName}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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
