"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { cn } from "@repo/ui";

export function Editor({
  content,
  onChange,
  className,
}: {
  content?: string;
  onChange?: (content: string) => void;
  className?: string;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: content || "<p>Hello World! 🌎</p>",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  return (
    <div
      className={cn(
        "relative min-h-[500px] w-full border rounded-md p-4",
        className
      )}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
