"use client";

import dynamic from "next/dynamic";
import { memo, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import "@repo/editor/styles";

const TiptapEditor = dynamic(
  () => import("@repo/editor").then((mod) => mod.TiptapEditor),
  { ssr: false }
);

interface TiptapEditorClientProps {
  /** 初始内容（Tiptap JSON 字符串） */
  initialContent?: string;
  readonly?: boolean;
  placeholder?: string;
}

function parseInitialContent(initialContent?: string) {
  if (!initialContent) {
    return undefined;
  }
  try {
    return JSON.parse(initialContent);
  } catch {
    return undefined;
  }
}

export const TiptapEditorClient = memo(function TiptapEditorClient({
  initialContent,
  readonly = true,
  placeholder,
}: TiptapEditorClientProps) {
  const router = useRouter();
  const navigate = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router]
  );

  const { content, contentVersion } = useMemo(() => {
    const parsed = parseInitialContent(initialContent);
    return {
      content: parsed,
      contentVersion: initialContent ? 1 : 0,
    };
  }, [initialContent]);

  return (
    <TiptapEditor
      content={content}
      contentVersion={contentVersion}
      readonly={readonly}
      showAiTools={false}
      placeholder={placeholder}
      navigate={navigate}
    />
  );
});
