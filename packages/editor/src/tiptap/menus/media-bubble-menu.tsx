import { Button } from "@repo/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Input } from "@repo/ui/input";
import type { Editor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import { useEditorState } from "@tiptap/react";
import { LinkIcon, Trash2Icon, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { useState } from "react";
import { useAIPanelStore } from "../../components/ai-panel/ai-panel-store";

function MediaBubbleMenuInner({ editor }: { editor: Editor }) {
  const isThinking = useAIPanelStore((state) => state.isThinking);
  const isStreaming = useAIPanelStore((state) => state.isStreaming);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");

  const currentAlignment = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      if (!ed.isActive("image")) {
        return "center";
      }
      const alignment = ed.getAttributes("image").alignment as
        | "left"
        | "center"
        | "right"
        | undefined;
      return alignment ?? "center";
    },
  });

  const handleDelete = () => {
    editor.chain().focus().deleteSelection().run();
  };

  const setAlignment = (align: "left" | "center" | "right") => {
    editor.chain().focus().updateAttributes("image", { alignment: align }).run();
  };

  const openReplaceDialog = () => {
    setNewUrl(editor.getAttributes("image").src || "");
    setUrlDialogOpen(true);
  };

  const handleReplaceUrl = () => {
    if (!newUrl.trim()) return;

    editor.chain().focus().setImage({ src: newUrl }).run();

    setUrlDialogOpen(false);
    setNewUrl("");
  };

  return (
    <>
      <BubbleMenu
        editor={editor}
        pluginKey="editorMediaBubbleMenu"
        options={{
          placement: "top",
          offset: 8,
        }}
        shouldShow={({ editor }) => {
          return (
            editor.isActive("image") && !isThinking && !isStreaming
          );
        }}
      >
        <div className="flex items-center gap-1 rounded-md border bg-popover p-1 shadow-xl">
          <>
            <div className="flex items-center gap-0.5 border-r pr-1 mr-1">
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 w-8 p-0 ${currentAlignment === "left" ? "bg-accent" : ""}`}
                onClick={() => setAlignment("left")}
                title="左对齐"
              >
                <AlignLeft className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 w-8 p-0 ${currentAlignment === "center" ? "bg-accent" : ""}`}
                onClick={() => setAlignment("center")}
                title="居中"
              >
                <AlignCenter className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 w-8 p-0 ${currentAlignment === "right" ? "bg-accent" : ""}`}
                onClick={() => setAlignment("right")}
                title="右对齐"
              >
                <AlignRight className="size-4" />
              </Button>
            </div>
          </>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={openReplaceDialog}
          >
            <LinkIcon className="size-4 mr-1" />
            Replace
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-destructive hover:text-destructive"
            onClick={handleDelete}
          >
            <Trash2Icon className="size-4 mr-1" />
            Delete
          </Button>
        </div>
      </BubbleMenu>

      <Dialog open={urlDialogOpen} onOpenChange={setUrlDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Replace Image URL</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Input
              placeholder="Enter new URL..."
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleReplaceUrl();
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setUrlDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleReplaceUrl} disabled={!newUrl.trim()}>
                Replace
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const MediaBubbleMenu = ({ editor }: { editor: Editor | null }) => {
  if (!editor) {
    return null;
  }
  return <MediaBubbleMenuInner editor={editor} />;
};
