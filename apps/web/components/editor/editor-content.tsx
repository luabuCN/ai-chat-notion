"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { EditorPageHeader } from "./editor-page-header";
import { EditorClient } from "./editor-client";
import { useGetDocument, useUpdateDocument } from "@/hooks/use-document-query";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/use-debounce";

interface EditorContentProps {
  locale: string;
  documentId: string;
}

export function EditorContent({ locale, documentId }: EditorContentProps) {
  const { data: document, isLoading, error } = useGetDocument(documentId);
  const updateDocumentMutation = useUpdateDocument();
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const contentDebounced = useDebounce(content, 1000);
  const titleDebounced = useDebounce(title, 500);
  const iconDebounced = useDebounce(icon, 500);

  // 从 query 数据同步到本地 state（用于防抖编辑）
  // 使用 documentId 作为依赖，只在文档切换时同步，避免更新时的循环
  const prevDocumentIdRef = useRef<string | null>(null);
  const prevTitleRef = useRef<string>("");
  const prevIconRef = useRef<string | null>(null);
  const prevContentRef = useRef<string>("");

  useEffect(() => {
    // 当文档加载完成且 documentId 发生变化时，更新本地 state
    if (document) {
      const isDocumentChanged = documentId !== prevDocumentIdRef.current;
      
      if (isDocumentChanged) {
        prevDocumentIdRef.current = documentId;
        const newTitle = document.title ?? "";
        const newIcon = document.icon ?? null;
        const newContent = document.content ?? "";
        
        setTitle(newTitle);
        setIcon(newIcon);
        setContent(newContent);
        
        // 重置 refs，避免下次比较时误判
        prevTitleRef.current = newTitle;
        prevIconRef.current = newIcon;
        prevContentRef.current = newContent;
        
        // 发送文档加载事件，通知其他组件
        window.dispatchEvent(
          new CustomEvent("document-loaded", { detail: document })
        );
      }
    }
  }, [document, documentId]);

  // 显示错误
  useEffect(() => {
    if (error) {
      toast.error(error.message || "加载文档失败");
    }
  }, [error]);

  // 防抖保存标题
  useEffect(() => {
    if (
      !documentId ||
      !document ||
      titleDebounced === document.title ||
      titleDebounced === "" ||
      titleDebounced === prevTitleRef.current
    )
      return;

    prevTitleRef.current = titleDebounced;
    window.dispatchEvent(new CustomEvent("document-saving"));
    setIsSaving(true);
    setIsSaved(false);
    updateDocumentMutation.mutate(
      {
        documentId,
        updates: { title: titleDebounced },
      },
      {
        onSuccess: () => {
          setIsSaving(false);
          setIsSaved(true);
          window.dispatchEvent(new CustomEvent("document-saved"));
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }
          saveTimeoutRef.current = setTimeout(() => {
            setIsSaved(false);
          }, 2000);
        },
        onError: (error) => {
          setIsSaving(false);
          setIsSaved(false);
          toast.error(error.message || "更新标题失败");
        },
      }
    );
  }, [titleDebounced, documentId, document?.title, updateDocumentMutation.mutate]);

  // 防抖保存icon
  useEffect(() => {
    if (
      !documentId ||
      !document ||
      iconDebounced === document.icon ||
      iconDebounced === prevIconRef.current
    )
      return;

    prevIconRef.current = iconDebounced;
    window.dispatchEvent(new CustomEvent("document-saving"));
    setIsSaving(true);
    setIsSaved(false);
    updateDocumentMutation.mutate(
      {
        documentId,
        updates: { icon: iconDebounced },
      },
      {
        onSuccess: () => {
          setIsSaving(false);
          setIsSaved(true);
          window.dispatchEvent(new CustomEvent("document-saved"));
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }
          saveTimeoutRef.current = setTimeout(() => {
            setIsSaved(false);
          }, 2000);
        },
        onError: (error) => {
          setIsSaving(false);
          setIsSaved(false);
          toast.error(error.message || "更新图标失败");
        },
      }
    );
  }, [iconDebounced, documentId, document?.icon, updateDocumentMutation.mutate]);

  // 防抖保存内容
  useEffect(() => {
    if (
      !documentId ||
      !document ||
      contentDebounced === document.content ||
      contentDebounced === prevContentRef.current
    )
      return;

    prevContentRef.current = contentDebounced;
    window.dispatchEvent(new CustomEvent("document-saving"));
    setIsSaving(true);
    setIsSaved(false);
    updateDocumentMutation.mutate(
      {
        documentId,
        updates: { content: contentDebounced },
      },
      {
        onSuccess: () => {
          setIsSaving(false);
          setIsSaved(true);
          window.dispatchEvent(new CustomEvent("document-saved"));
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }
          saveTimeoutRef.current = setTimeout(() => {
            setIsSaved(false);
          }, 2000);
        },
        onError: (error) => {
          setIsSaving(false);
          setIsSaved(false);
          toast.error(error.message || "保存内容失败");
        },
      }
    );
  }, [contentDebounced, documentId, document?.content, updateDocumentMutation.mutate]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle);
  }, []);

  const handleIconChange = useCallback((newIcon: string | null) => {
    setIcon(newIcon);
  }, []);

  const handleCoverChange = useCallback(
    async (cover: string | null, coverImageType?: "color" | "url") => {
      if (!documentId) return;

      setIsSaving(true);
      setIsSaved(false);
      const type =
        coverImageType ||
        (cover?.startsWith("#") || cover?.startsWith("linear-gradient")
          ? "color"
          : "url");

      window.dispatchEvent(new CustomEvent("document-saving"));
      updateDocumentMutation.mutate(
        {
          documentId,
          updates: { coverImage: cover, coverImageType: type },
        },
        {
          onSuccess: () => {
            setIsSaving(false);
            setIsSaved(true);
            window.dispatchEvent(new CustomEvent("document-saved"));
            if (saveTimeoutRef.current) {
              clearTimeout(saveTimeoutRef.current);
            }
            saveTimeoutRef.current = setTimeout(() => {
              setIsSaved(false);
            }, 2000);
          },
          onError: (error) => {
            setIsSaving(false);
            setIsSaved(false);
            toast.error(error.message || "更新封面失败");
          },
        }
      );
    },
    [documentId, updateDocumentMutation.mutate]
  );

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
  }, []);

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
        initialTitle={title}
        initialIcon={icon}
        initialCover={document?.coverImage ?? null}
        coverImageType={
          (document?.coverImageType as "color" | "url" | null) ?? "url"
        }
        onTitleChange={handleTitleChange}
        onIconChange={handleIconChange}
        onCoverChange={handleCoverChange}
      />

      <div className="max-w-4xl mx-auto px-4 pb-20">
        {document && (
          <EditorClient
            key={`${documentId}-${content ? "loaded" : "empty"}`}
            locale={locale}
            apiUrl="/api/blocknote-ai"
            initialContent={content}
            onChange={handleContentChange}
          />
        )}
      </div>
    </div>
  );
}
