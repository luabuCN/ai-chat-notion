"use client";

import { useEffect, useState } from "react";
import { useMutationState } from "@tanstack/react-query";
import { EditorHeader } from "./editor-header";
import { TrashBanner } from "./trash-banner";
import { useGetDocument, documentKeys } from "@/hooks/use-document-query";

interface EditorHeaderWrapperProps {
  locale: string;
  documentId: string;
  /** PDF 转换进行中：顶部栏操作全部禁用 */
  conversionLocked?: boolean;
  currentUserId?: string;
  currentUserName?: string;
  currentUserEmail?: string;
  /** 全宽模式 */
  isFullWidth?: boolean;
  /** 全宽模式切换 */
  onFullWidthChange?: (checked: boolean) => void;
}

export function EditorHeaderWrapper({
  locale,
  documentId,
  conversionLocked = false,
  currentUserId,
  currentUserName,
  currentUserEmail,
  isFullWidth = false,
  onFullWidthChange,
}: EditorHeaderWrapperProps) {
  const { data: document } = useGetDocument(documentId);
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const mutations = useMutationState({
    filters: { mutationKey: documentKeys.updates() },
    select: (mutation: any) => mutation.state,
  });

  const latestMutation = mutations
    .filter((m) => (m.variables as any)?.documentId === documentId)
    .pop();

  const isSaving = latestMutation?.status === "pending";
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (document) {
      // 动态更新标题
      const title = document.title || "未命名";
      window.document.title = `${title} - 知作`;

      // 动态更新 favicon
      const icon = document.icon;
      let faviconUrl = "/favicon.ico";

      if (icon) {
        // 如果是 emoji 则转换为 SVG Data URL
        faviconUrl = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>${icon}</text></svg>`;
      }

      const link: HTMLLinkElement | null =
        window.document.querySelector("link[rel*='icon']");
      if (link) {
        link.href = faviconUrl;
      } else {
        const newLink = window.document.createElement("link");
        newLink.rel = "shortcut icon";
        newLink.href = faviconUrl;
        window.document.getElementsByTagName("head")[0].appendChild(newLink);
      }
    }
  }, [document?.title, document?.icon]);

  useEffect(() => {
    if (latestMutation?.status === "success") {
      setIsSaved(true);
      const timer = setTimeout(() => setIsSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [latestMutation?.submittedAt, latestMutation?.status]);

  if (document?.deletedAt) {
    return (
      <div className="flex flex-col">
        <TrashBanner documentId={documentId} />
      </div>
    );
  }

  // 只读模式：accessLevel 为 view 时隐藏编辑按钮
  const isReadOnly = (document as any)?.accessLevel === "view";
  const isOwner = (document as any)?.accessLevel === "owner";

  return (
    <EditorHeader
      locale={locale}
      documentTitle={document?.title}
      documentIcon={document?.icon ?? null}
      documentId={documentId}
      workspaceId={document?.workspaceId ?? null}
      isPublished={document?.isPublished}
      isPubliclyEditable={(document as any)?.isPubliclyEditable ?? false}
      isFavorite={document?.isFavorite}
      isSaving={isSaving}
      isSaved={isSaved}
      readonly={isReadOnly}
      isOwner={isOwner}
      conversionLocked={conversionLocked}
      sourcePdfUrl={document?.sourcePdfUrl ?? null}
      sourcePageUrl={document?.sourcePageUrl ?? null}
      currentUserId={currentUserId}
      currentUserName={currentUserName}
      currentUserEmail={currentUserEmail}
      documentOwnerId={document?.userId}
      hasCollaborators={(document as any)?.hasCollaborators ?? false}
      publicShareToken={(document as any)?.publicShareToken ?? null}
      isFullWidth={isFullWidth}
      onFullWidthChange={onFullWidthChange}
    />
  );
}
