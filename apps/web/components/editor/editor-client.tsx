"use client";

import dynamic from "next/dynamic";
import { useCallback } from "react";
import { toast } from "sonner";
import "@repo/editor/styles";

const TiptapEditor = dynamic(
  () => import("@repo/editor").then((mod) => mod.TiptapEditor),
  { ssr: false }
);

interface EditorClientProps {
  initialContent?: any;
  onChange?: (content: any) => void;
}

export function EditorClient({ initialContent, onChange }: EditorClientProps) {
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

  // 解析 JSON 字符串为对象
  const parsedContent = initialContent ? JSON.parse(initialContent) : undefined;

  return (
    <TiptapEditor
      content={parsedContent}
      placeholder="Type / for commands..."
      showAiTools={true}
      uploadFile={uploadFile}
      onUpdate={(editor) => {
        // 序列化为 JSON 字符串
        onChange?.(JSON.stringify(editor.getJSON()));
      }}
    />
  );
}
