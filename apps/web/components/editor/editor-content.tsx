"use client";

import { useEffect, useState } from "react";
import { EditorPageHeader } from "./editor-page-header";
import { EditorClient } from "./editor-client";
import type { EditorDocument } from "@repo/database";
import { useGetDocument, useUpdateDocument } from "@/hooks/use-document-query";
import { toast } from "sonner";

interface EditorContentProps {
  locale: string;
  documentId: string;
}

export function EditorContent({ locale, documentId }: EditorContentProps) {
  const [document, setDocument] = useState<EditorDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { trigger: getDocument } = useGetDocument();
  const { trigger: updateDocument } = useUpdateDocument();

  useEffect(() => {
    if (documentId) {
      setIsLoading(true);
      getDocument(documentId, {
        onSuccess: (doc) => {
          setDocument(doc);
          setIsLoading(false);
        },
        onError: (error) => {
          toast.error(error.message || "加载文档失败");
          setIsLoading(false);
        },
      });
    } else {
      setIsLoading(false);
    }
  }, [documentId, getDocument]);

  const handleTitleChange = async (title: string) => {
    if (!documentId) return;

    await updateDocument(
      documentId,
      { title },
      {
        onSuccess: (updatedDoc) => {
          setDocument(updatedDoc);
        },
        onError: (error) => {
          toast.error(error.message || "更新标题失败");
        },
      }
    );
  };

  const handleCoverChange = async (
    cover: string | null,
    coverImageType?: "color" | "url"
  ) => {
    if (!documentId) return;

    // 判断是纯色还是 URL
    const type =
      coverImageType ||
      (cover?.startsWith("#") || cover?.startsWith("linear-gradient")
        ? "color"
        : "url");

    await updateDocument(
      documentId,
      { coverImage: cover, coverImageType: type },
      {
        onSuccess: (updatedDoc) => {
          setDocument(updatedDoc);
        },
        onError: (error) => {
          toast.error(error.message || "更新封面失败");
        },
      }
    );
  };

  const handleContentChange = async (content: string) => {
    if (!documentId) return;

    // 使用防抖来避免频繁更新
    await updateDocument(
      documentId,
      { content },
      {
        onError: (error) => {
          toast.error(error.message || "保存内容失败");
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <EditorPageHeader
        initialTitle={document?.title ?? ""}
        initialCover={document?.coverImage ?? null}
        coverImageType={
          (document?.coverImageType as "color" | "url" | null) ?? "url"
        }
        onTitleChange={handleTitleChange}
        onCoverChange={(cover) => handleCoverChange(cover)}
      />

      <div className="max-w-4xl mx-auto px-4 pb-20">
        <EditorClient
          locale={locale}
          apiUrl="/api/blocknote-ai"
          initialContent={document?.content ?? ""}
          onChange={handleContentChange}
        />
      </div>
    </div>
  );
}
