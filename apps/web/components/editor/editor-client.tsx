"use client";

import dynamic from "next/dynamic";
import { memo, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
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

  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Upload successful", data);

        const { url } = data;
        return url;
      }
      const { error } = await response.json();
      toast.error(error);
      throw new Error(error);
    } catch (_error) {
      toast.error("Failed to upload file, please try again!");
      throw _error;
    }
  }, []);

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
