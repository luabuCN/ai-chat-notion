"use client";

import dynamic from "next/dynamic";
import { memo, useCallback, useMemo, useRef } from "react";
import { useFileUploadMutation } from "@/hooks/use-file-upload-mutation";
import "@repo/editor/styles";

const TiptapEditor = dynamic(
  () => import("@repo/editor").then((mod) => mod.TiptapEditor),
  { ssr: false }
);

interface EditorClientProps {
  initialContent?: any;
  onChange?: (content: any) => void;
  readonly?: boolean;
}

export const EditorClient = memo(function EditorClient({
  initialContent,
  onChange,
  readonly,
}: EditorClientProps) {
  // 用 ref 存储 onChange，避免回调变化导致重渲染
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // 只在挂载时解析 initialContent
  const initialContentRef = useRef(initialContent);
  const parsedContent = useMemo(
    () =>
      initialContentRef.current
        ? JSON.parse(initialContentRef.current)
        : undefined,
    []
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
      placeholder="Type / for commands..."
      showAiTools={true}
      uploadFile={uploadFile}
      onUpdate={handleUpdate}
      readonly={readonly}
    />
  );
});
