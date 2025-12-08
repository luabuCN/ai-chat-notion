"use client";

import dynamic from "next/dynamic";
import { NoteEditorOptions } from "@repo/editor";
import { useTheme } from "next-themes";

const BlockNoteEditor = dynamic(
  () => import("@repo/editor").then((mod) => mod.NoteEditor),
  { ssr: false }
);

export function EditorClient(props: NoteEditorOptions) {
  const { resolvedTheme } = useTheme();

  return (
    <BlockNoteEditor
      key={props.locale}
      {...props}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  );
}
