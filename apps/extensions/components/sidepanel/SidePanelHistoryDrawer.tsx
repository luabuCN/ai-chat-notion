import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  cn,
  Drawer,
  DrawerContent,
  DrawerTitle,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui";
import { Clock3, Loader2, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { MainSiteAuthState } from "@/hooks/use-main-site-auth";
import {
  deleteAllSidepanelHistory,
  deleteOneSidepanelHistory,
  fetchSidepanelHistory,
  type SidepanelChatHistoryItem,
} from "@/lib/sidepanel-history-api";

function formatTimeLabel(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SidePanelHistoryDrawer({
  auth,
  currentChatId,
  onSelectChat,
  workspaceSlug,
}: {
  auth: MainSiteAuthState;
  currentChatId?: string;
  onSelectChat?: (chatId: string) => Promise<void>;
  workspaceSlug: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<SidepanelChatHistoryItem[]>([]);
  const [deletingAll, setDeletingAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openingChatId, setOpeningChatId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);

  const authenticated = auth.data?.authenticated === true;

  const loadHistory = useCallback(async () => {
    if (!authenticated) {
      setItems([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await fetchSidepanelHistory(
        50,
        workspaceSlug.trim() ? workspaceSlug : undefined,
      );
      setItems(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载历史失败");
    } finally {
      setLoading(false);
    }
  }, [authenticated, workspaceSlug]);

  useEffect(() => {
    if (!open) {
      return;
    }
    void loadHistory();
  }, [open, loadHistory]);

  const onDeleteAllConfirmed = async () => {
    setShowDeleteAllDialog(false);
    setDeletingAll(true);
    setError(null);
    try {
      await deleteAllSidepanelHistory();
      setItems([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除全部失败");
    } finally {
      setDeletingAll(false);
    }
  };

  const onDeleteOneConfirmed = async () => {
    if (pendingDeleteId === null) {
      return;
    }
    const chatId = pendingDeleteId;
    setPendingDeleteId(null);
    setDeletingId(chatId);
    setError(null);
    try {
      await deleteOneSidepanelHistory(chatId);
      setItems((s) => s.filter((item) => item.id !== chatId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeletingId(null);
    }
  };

  const onOpenChat = async (chatId: string) => {
    if (!onSelectChat) {
      return;
    }
    setOpeningChatId(chatId);
    setError(null);
    try {
      await onSelectChat(chatId);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "打开历史会话失败");
    } finally {
      setOpeningChatId(null);
    }
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label="历史记录"
              className="size-8 shrink-0 rounded-lg"
              onClick={() => setOpen(true)}
              type="button"
              variant="ghost"
            >
              <Clock3 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">历史记录</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Drawer onOpenChange={setOpen} open={open}>
        <DrawerContent
          className="mx-auto flex w-full max-w-[min(100vw,360px)] flex-col p-0"
          showHandle={false}
        >
        <div className="flex items-center justify-between border-border border-b px-3 py-2.5">
          <DrawerTitle className="font-medium text-sm">历史记录</DrawerTitle>
          <div className="flex items-center gap-1">
            <Button
              className="h-8 px-2 text-xs"
              disabled={!authenticated || items.length === 0 || deletingAll}
              onClick={() => setShowDeleteAllDialog(true)}
              type="button"
              variant="ghost"
            >
              {deletingAll ? (
                <Loader2 className="mr-1 size-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1 size-3.5" />
              )}
              删除全部
            </Button>
            <Button
              aria-label="关闭"
              className="size-8 rounded-lg"
              onClick={() => setOpen(false)}
              type="button"
              variant="ghost"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {!authenticated ? (
            <p className="px-2 py-6 text-center text-muted-foreground text-sm">
              请先登录主站后查看历史记录
            </p>
          ) : loading ? (
            <ul className="space-y-3 px-1 py-1">
              {Array.from({ length: 8 }).map((_, index) => (
                <li className="space-y-1" key={`history-skeleton-${index}`}>
                  <Skeleton className="h-5 w-[78%]" />
                  <Skeleton className="h-4 w-20" />
                </li>
              ))}
            </ul>
          ) : items.length === 0 ? (
            <p className="px-2 py-6 text-center text-muted-foreground text-sm">
              暂无历史记录
            </p>
          ) : (
            <ul className="space-y-1">
              {items.map((item) => {
                const deleting = deletingId === item.id;
                const opening = openingChatId === item.id;
                const active = currentChatId === item.id;
                return (
                  <li
                    className={cn(
                      "flex items-start justify-between gap-2 rounded-lg px-2 py-2 hover:bg-muted/60",
                      active && "bg-muted",
                    )}
                    key={item.id}
                  >
                    <button
                      className="min-w-0 flex-1 text-left"
                      disabled={opening}
                      onClick={() => void onOpenChat(item.id)}
                      type="button"
                    >
                      <p className="truncate text-foreground text-sm">
                        {opening ? "正在加载…" : item.title || "未命名会话"}
                      </p>
                      <p className="truncate text-muted-foreground text-xs">
                        {formatTimeLabel(item.createdAt)}
                      </p>
                    </button>
                    <Button
                      aria-label="删除该历史记录"
                      className="size-8 shrink-0 rounded-lg"
                      disabled={deleting}
                      onClick={() => setPendingDeleteId(item.id)}
                      type="button"
                      variant="ghost"
                    >
                      {deleting ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {error ? (
          <p className="shrink-0 border-border border-t px-3 py-2 text-destructive text-xs">
            {error}
          </p>
        ) : null}
        </DrawerContent>
      </Drawer>

      <AlertDialog
        onOpenChange={(next) => {
          if (!next) {
            setPendingDeleteId(null);
          }
        }}
        open={pendingDeleteId !== null}
      >
        <AlertDialogContent className="max-w-[min(100vw-2rem,360px)]">
          <AlertDialogHeader>
            <AlertDialogTitle>删除该会话？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销，该会话将从历史记录中永久删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void onDeleteOneConfirmed()}
              type="button"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        onOpenChange={setShowDeleteAllDialog}
        open={showDeleteAllDialog}
      >
        <AlertDialogContent className="max-w-[min(100vw-2rem,360px)]">
          <AlertDialogHeader>
            <AlertDialogTitle>删除全部历史？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除当前账号下的全部会话记录，此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void onDeleteAllConfirmed()}
              type="button"
            >
              全部删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
