"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { CollaborationProvider } from "./collaboration-context";
import { EditorHeaderWrapper } from "./editor-header-wrapper";
import { EditorContent } from "./editor-content";
import { EditorLoadingSkeleton } from "./editor-loading-skeleton";
import { DocumentSearchPalette } from "./document-search-palette";
import { useEditorDocumentAccess } from "@/hooks/use-editor-document-access";
import { useSidebar } from "@repo/ui";
import { useLocalStorage } from "usehooks-ts";
import {
  useConvertTask,
  isConvertTaskPipelineBusy,
} from "@/lib/document-import/convert-store";
import { EditorScrollNav } from "./editor-scroll-nav";
import { useEditorPageShortcuts } from "@/lib/use-editor-page-shortcuts";
import { ArrowLeftRight, FileQuestion, ShieldAlert, LogIn } from "lucide-react";
import Link from "next/link";

interface EditorPageClientProps {
  locale: string;
  documentId: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  /** 与 NextAuth Session.user.avatarUrl 对齐，供协同与评论原型展示头像 */
  userAvatarUrl?: string;
}

export function EditorPageClient({
  locale,
  documentId,
  userId,
  userName,
  userEmail,
  userAvatarUrl,
}: EditorPageClientProps) {
  const {
    document,
    isPending: isDocumentPending,
    accessLevel,
    pageStatus,
    error: docError,
    workspaceMismatch,
    workspaceSlug,
    listWorkspaceId,
    goToDocumentWorkspace,
  } = useEditorDocumentAccess(documentId);
  const { state, isMobile } = useSidebar();
  const [mounted, setMounted] = useState(false);
  const [isFullWidth, setIsFullWidth] = useLocalStorage("editor-full-width", false);
  const convertTask = useConvertTask(documentId);
  const conversionLocked = isConvertTaskPipelineBusy(convertTask);
  const [documentSearchOpen, setDocumentSearchOpen] = useState(false);

  const isDocumentEditable =
    Boolean(document) &&
    pageStatus === "ready" &&
    document?.deletedAt == null &&
    accessLevel !== "view" &&
    !conversionLocked;

  const toggleDocumentSearch = useCallback(() => {
    setDocumentSearchOpen((prev) => !prev);
  }, []);

  const documentSearchShortcut = useMemo(
    () => ({
      enabled: isDocumentEditable,
      onToggleOpen: toggleDocumentSearch,
    }),
    [isDocumentEditable, toggleDocumentSearch]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEditorPageShortcuts({
    enabled: pageStatus === "ready",
    documentSearch: documentSearchShortcut,
  });

  // 计算头部的 left 位置
  // 在客户端 hydration 完成前，使用 CSS 变量让浏览器自动处理
  const headerLeft = !mounted
    ? undefined // 服务端渲染时不设置，让 CSS 处理
    : isMobile
    ? "0"
    : state === "collapsed"
    ? "0"
    : "var(--sidebar-width)";

  if (pageStatus === "workspace_mismatch") {
    const { targetWorkspace, targetWorkspaceName } = workspaceMismatch;

    return (
      <div className="flex h-dvh min-w-0 w-full flex-col bg-background">
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="flex flex-col items-center gap-4 text-center max-w-md">
            <ArrowLeftRight className="size-16 text-muted-foreground/60" />
            <h2 className="text-xl font-semibold text-foreground">
              文档不在当前空间
            </h2>
            <p className="text-sm text-muted-foreground">
              此文档属于「{targetWorkspaceName}」空间，请切换到正确空间后再查看
            </p>
            <div className="flex gap-3 mt-2">
              {targetWorkspace ? (
                <button
                  type="button"
                  onClick={() => {
                    void goToDocumentWorkspace();
                  }}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <ArrowLeftRight className="size-4" />
                  前往正确空间
                </button>
              ) : null}
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
              >
                返回首页
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (
    pageStatus === "unauthorized" ||
    pageStatus === "forbidden" ||
    pageStatus === "not_found" ||
    pageStatus === "error"
  ) {
    const isUnauthorized = pageStatus === "unauthorized";
    const isForbidden = pageStatus === "forbidden";
    const isNotFound = pageStatus === "not_found";

    return (
      <div className="flex h-dvh min-w-0 w-full flex-col bg-background">
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="flex flex-col items-center gap-4 text-center max-w-md">
            {isUnauthorized ? (
              <ShieldAlert className="size-16 text-muted-foreground/60" />
            ) : (
              <FileQuestion className="size-16 text-muted-foreground/60" />
            )}
            <h2 className="text-xl font-semibold text-foreground">
              {isUnauthorized
                ? "请先登录"
                : isForbidden
                ? "无访问权限"
                : isNotFound
                ? "文档不存在"
                : "加载失败"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isUnauthorized
                ? "你需要登录后才能查看此文档"
                : isForbidden
                ? "你没有权限查看此文档，请联系文档所有者获取访问权限"
                : isNotFound
                ? "此文档不存在或已被删除"
                : docError?.message || "加载文档时发生错误，请稍后重试"}
            </p>
            <div className="flex gap-3 mt-2">
              {isUnauthorized ? (
                <Link
                  href={`/sign-in?callbackUrl=${encodeURIComponent(`/editor/${documentId}`)}`}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <LogIn className="size-4" />
                  登录
                </Link>
              ) : (
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  返回首页
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CollaborationProvider>
      {/* h-dvh 而非 min-h-dvh：将滚动容器固定在视口高度内，
          避免 body 产生滚动条。Radix overlay 打开时不会因
          react-remove-scroll 移除 body 滚动条而引发布局抖动。 */}
      <div className="flex h-dvh min-w-0 w-full flex-col bg-background">
        {isDocumentPending ? (
          /* 首包未返回前不渲染顶栏，避免出现「未命名」+ 下方骨架的错位感 */
          <div
            id="editor-scroll-container"
            className="min-h-0 flex-1 overflow-y-auto"
          >
            <EditorLoadingSkeleton className="min-h-full" />
          </div>
        ) : (
          <>
            {/* 固定头部 */}
            <div
              className="fixed top-0 right-0 z-50 bg-background transition-[left] duration-200 ease-linear left-0 md:left-[var(--sidebar-width)]"
              style={mounted ? { left: headerLeft } : undefined}
            >
              <EditorHeaderWrapper
                locale={locale}
                documentId={documentId}
                conversionLocked={conversionLocked}
                currentUserId={userId}
                currentUserName={userName}
                currentUserEmail={userEmail}
                currentUserAvatarUrl={userAvatarUrl}
                isFullWidth={isFullWidth}
                onFullWidthChange={setIsFullWidth}
              />
            </div>
            {/* overflow-y-auto：让内容在此容器内滚动，而非 body；id 供气泡菜单与滚动导航定位 */}
            <div
              id="editor-scroll-container"
              className="flex-1 overflow-y-auto scroll-pb-20 scroll-pt-11"
            >
              <EditorContent
                locale={locale}
                documentId={documentId}
                conversionLocked={conversionLocked}
                userId={userId}
                userName={userName}
                userEmail={userEmail}
                userAvatarUrl={userAvatarUrl}
                isFullWidth={isFullWidth}
              />
            </div>
            <EditorScrollNav />
            <DocumentSearchPalette
              open={documentSearchOpen}
              onOpenChange={setDocumentSearchOpen}
              workspaceId={listWorkspaceId ?? undefined}
              workspaceSlug={workspaceSlug}
            />
          </>
        )}
      </div>
    </CollaborationProvider>
  );
}
