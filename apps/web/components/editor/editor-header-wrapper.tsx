"use client";

import { useEffect, useState } from "react";
import { useMutationState } from "@tanstack/react-query";
import { EditorHeader } from "./editor-header";
import { TrashBanner } from "./trash-banner";
import { useGetDocument, documentKeys } from "@/hooks/use-document-query";
import { getFaviconUrl, setFavicon, setPageTitle } from "@/lib/page-metadata";

interface EditorHeaderWrapperProps {
  locale: string;
  documentId: string;
  /** PDF 转换进行中：顶部栏操作全部禁用 */
  conversionLocked?: boolean;
  currentUserId?: string;
  currentUserName?: string;
  currentUserEmail?: string;
  /** 与协同 awareness 一致的当前用户头像，用于兜底渲染 viewer 自己 */
  currentUserAvatarUrl?: string;
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
  currentUserAvatarUrl,
  isFullWidth = false,
  onFullWidthChange,
}: EditorHeaderWrapperProps) {
  const { data: document } = useGetDocument(documentId, { metadataOnly: true });
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
    if (!document) {
      return;
    }

    const title = document.title || "未命名";
    setPageTitle(`${title} - 知作`);
    setFavicon(getFaviconUrl(document.icon));
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
  const canManage = (document as any)?.canManage ?? isOwner;

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
      canManage={canManage}
      conversionLocked={conversionLocked}
      sourcePdfUrl={document?.sourcePdfUrl ?? null}
      sourcePageUrl={document?.sourcePageUrl ?? null}
      currentUserId={currentUserId}
      currentUserName={currentUserName}
      currentUserEmail={currentUserEmail}
      currentUserAvatarUrl={currentUserAvatarUrl}
      documentOwnerId={document?.userId}
      hasCollaborators={(document as any)?.hasCollaborators ?? false}
      publicShareToken={(document as any)?.publicShareToken ?? null}
      isFullWidth={isFullWidth}
      onFullWidthChange={onFullWidthChange}
    />
  );
}
