import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui";
import { Loader2, MessageCircle, ScanLine, Zap } from "lucide-react";
import { useExtensionPortalContainer } from "@/lib/extension-portal-context";

type ImageHoverToolbarProps = {
  anchorRect: DOMRectReadOnly;
  busy: boolean;
  errorMessage: string | null;
  menuOpen: boolean;
  onExtract: () => void;
  onImageChat: () => void;
  onOpenChange: (open: boolean) => void;
};

export function ImageHoverToolbar({
  anchorRect,
  busy,
  errorMessage,
  menuOpen,
  onExtract,
  onImageChat,
  onOpenChange,
}: ImageHoverToolbarProps) {
  const extensionMenuPortalHost = useExtensionPortalContainer();

  return (
    <div
      className="pointer-events-none"
      data-wisewrite-image-toolbar=""
      style={{
        height: anchorRect.height,
        left: anchorRect.left,
        position: "fixed",
        top: anchorRect.top,
        width: anchorRect.width,
        zIndex: 2_147_483_647,
      }}
    >
      <div className="pointer-events-none flex h-full w-full flex-col items-end justify-end p-1.5">
        <DropdownMenu modal={false} onOpenChange={onOpenChange} open={menuOpen}>
          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-busy={busy}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  aria-label="图片工具"
                  className="pointer-events-auto size-9 shrink-0 touch-manipulation cursor-pointer rounded-full border border-white/15 bg-slate-800 text-white shadow-[0_4px_14px_rgba(15,23,42,0.35)] transition-[transform,background-color,box-shadow] duration-150 hover:bg-slate-700 hover:shadow-[0_6px_18px_rgba(15,23,42,0.45)] active:scale-[0.97] active:bg-slate-500 active:shadow-[0_2px_8px_rgba(15,23,42,0.3)] disabled:pointer-events-none disabled:opacity-60"
                  disabled={busy}
                  size="sm"
                  type="button"
                >
                  {busy ? (
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                  ) : (
                    <Zap aria-hidden className="size-4" strokeWidth={2.25} />
                  )}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent
              className="border-slate-200 bg-white text-slate-900 shadow-md"
              side="top"
              sideOffset={8}
            >
              图片工具
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            align="end"
            className="z-[2147483647] min-w-44 border-slate-200/90 bg-white p-1 text-slate-900 shadow-lg"
            collisionPadding={12}
            container={extensionMenuPortalHost ?? undefined}
            data-wisewrite-image-toolbar=""
            onCloseAutoFocus={(e) => e.preventDefault()}
            side="top"
            sideOffset={8}
          >
            <DropdownMenuItem
              className="cursor-pointer gap-2 rounded-lg px-2 py-2 text-[14px]"
              disabled={busy}
              onSelect={(e) => {
                e.preventDefault();
                onImageChat();
              }}
            >
              <MessageCircle aria-hidden className="size-4 text-slate-600" />
              图片聊天
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer gap-2 rounded-lg px-2 py-2 text-[14px]"
              disabled={busy}
              onSelect={(e) => {
                e.preventDefault();
                onExtract();
              }}
            >
              <ScanLine aria-hidden className="size-4 text-slate-600" />
              提取文字
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {errorMessage ? (
        <p
          className="pointer-events-none mt-1 max-w-56 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-red-800 text-xs leading-snug shadow-sm"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
