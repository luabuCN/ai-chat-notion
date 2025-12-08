"use client";

import dynamic from "next/dynamic";
import { NoteEditorOptions } from "@repo/editor";
import { useTheme } from "next-themes";
import { useCallback } from "react";
import { toast } from "sonner";

const BlockNoteEditor = dynamic(
  () => import("@repo/editor").then((mod) => mod.NoteEditor),
  { ssr: false }
);

export function EditorClient(props: NoteEditorOptions) {
  const { resolvedTheme } = useTheme();

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

  return (
    <BlockNoteEditor
      key={props.locale}
      {...props}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      uploadFile={uploadFile}
    />
  );
}
