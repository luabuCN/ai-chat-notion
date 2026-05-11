import { Button } from "@repo/ui/button";
import { cn } from "../../../lib/utils";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import {
  FileIcon,
  FileTextIcon,
  ImageIcon,
  Trash2Icon,
  VideoIcon,
} from "lucide-react";

const getFileIcon = (fileType?: string) => {
  if (!fileType) return FileIcon;
  if (fileType.startsWith("image/")) return ImageIcon;
  if (fileType.startsWith("video/")) return VideoIcon;
  if (
    fileType.startsWith("text/") ||
    fileType.includes("pdf") ||
    fileType.includes("document")
  ) {
    return FileTextIcon;
  }
  return FileIcon;
};

export function AttachmentView({
  node,
  selected,
  editor,
  deleteNode,
}: NodeViewProps) {
  const { url, fileName, fileType } = node.attrs;
  const Icon = getFileIcon(fileType);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = () => {
    deleteNode();
  };

  return (
    <NodeViewWrapper className="attachment-node group relative">
      <button
        type="button"
        onClick={handleDownload}
        title={`下载 ${fileName}`}
        className={cn(
          "flex w-full max-w-full items-center gap-2 rounded-md px-2 py-1.5 pr-10 text-left text-sm transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          selected
            ? "bg-muted/40 ring-2 ring-primary ring-offset-2 ring-offset-background"
            : ""
        )}
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-medium">{fileName}</span>
      </button>
      {editor.isEditable ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="删除附件"
          className={cn(
            "absolute right-1 top-1/2 size-8 -translate-y-1/2 text-muted-foreground transition-opacity hover:text-destructive",
            "opacity-0 pointer-events-none",
            "group-hover:pointer-events-auto group-hover:opacity-100",
            "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
            selected && "pointer-events-auto opacity-100"
          )}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDelete();
          }}
        >
          <Trash2Icon className="size-4" aria-hidden />
        </Button>
      ) : null}
    </NodeViewWrapper>
  );
}
