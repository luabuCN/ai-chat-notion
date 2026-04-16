"use client";

import { useState, useEffect } from "react";
import { CollaborationProvider } from "./collaboration-context";
import { EditorHeaderWrapper } from "./editor-header-wrapper";
import { EditorContent } from "./editor-content";
import { useSidebar } from "@repo/ui";
import {
  useConvertTask,
  isConvertTaskPipelineBusy,
} from "@/lib/pdf/convert-store";

interface EditorPageClientProps {
  locale: string;
  documentId: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
}

export function EditorPageClient({
  locale,
  documentId,
  userId,
  userName,
  userEmail,
}: EditorPageClientProps) {
  const { state, isMobile } = useSidebar();
  const [mounted, setMounted] = useState(false);
  const convertTask = useConvertTask(documentId);
  const conversionLocked = isConvertTaskPipelineBusy(convertTask);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 计算头部的 left 位置
  // 在客户端 hydration 完成前，使用 CSS 变量让浏览器自动处理
  const headerLeft = !mounted
    ? undefined // 服务端渲染时不设置，让 CSS 处理
    : isMobile
    ? "0"
    : state === "collapsed"
    ? "0"
    : "var(--sidebar-width)";

  return (
    <CollaborationProvider>
      {/* h-dvh 而非 min-h-dvh：将滚动容器固定在视口高度内，
          避免 body 产生滚动条。Radix overlay 打开时不会因
          react-remove-scroll 移除 body 滚动条而引发布局抖动。 */}
      <div className="flex h-dvh min-w-0 w-full flex-col bg-background">
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
          />
        </div>
        {/* overflow-y-auto：让内容在此容器内滚动，而非 body */}
        <div className="flex-1 pt-11 overflow-y-auto">
          <EditorContent
            locale={locale}
            documentId={documentId}
            conversionLocked={conversionLocked}
            userId={userId}
            userName={userName}
            userEmail={userEmail}
          />
        </div>
      </div>
    </CollaborationProvider>
  );
}
