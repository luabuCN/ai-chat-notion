"use client";

import dynamic from "next/dynamic";
import { memo, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFileUploadMutation } from "@/hooks/use-file-upload-mutation";
import "@repo/editor/styles";

const TiptapEditor = dynamic(
  () => import("@repo/editor").then((mod) => mod.TiptapEditor),
  { ssr: false }
);

interface EditorClientProps {
  initialContent?: any;
  contentVersion?: number;
  onChange?: (content: any) => void;
  readonly?: boolean;
}

export const EditorClient = memo(function EditorClient({
  initialContent,
  contentVersion = 0,
  onChange,
  readonly,
}: EditorClientProps) {
  const router = useRouter();
  const navigate = useCallback((href: string) => router.push(href), [router]);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // 每次 contentVersion 变化时，把当前 initialContent 快照下来
  // 这样用户本地编辑（content state 变化）不会触发 parsedContent 重新计算
  const initialContentRef = useRef(initialContent);
  const prevVersionRef = useRef(contentVersion);
  if (prevVersionRef.current !== contentVersion) {
    prevVersionRef.current = contentVersion;
    initialContentRef.current = initialContent;
  }

  const parsedContent = useMemo(
    () =>
      initialContentRef.current
        ? JSON.parse(initialContentRef.current)
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contentVersion]
  );

  const { mutateAsync: uploadFileMutation } = useFileUploadMutation();

  const uploadFile = useCallback(
    async (file: File) => {
      const result = await uploadFileMutation(file);
      return result.url;
    },
    [uploadFileMutation]
  );

  const handleUpdate = useCallback((editor: any) => {
    onChangeRef.current?.(JSON.stringify(editor.getJSON()));
  }, []);

  return (
    <TiptapEditor
      content={parsedContent}
      contentVersion={contentVersion}
      placeholder="Type / for commands..."
      showAiTools={true}
      uploadFile={uploadFile}
      onUpdate={handleUpdate}
      readonly={readonly}
      navigate={navigate}
    />
  );
});
