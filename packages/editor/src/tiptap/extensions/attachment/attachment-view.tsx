import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import {
  DownloadIcon,
  FileIcon,
  FileTextIcon,
  ImageIcon,
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

const formatFileSize = (bytes?: number) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function AttachmentView({ node, selected }: NodeViewProps) {
  const { url, fileName, fileSize, fileType } = node.attrs;
  const Icon = getFileIcon(fileType);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <NodeViewWrapper>
      <div
        onClick={handleDownload}
        className={`
          flex items-center gap-3 p-3 my-2 rounded-lg border bg-muted/50 
          hover:bg-muted cursor-pointer transition-colors group
          ${selected ? "ring-2 ring-primary" : ""}
        `}
      >
        <div className="flex items-center justify-center size-10 rounded-lg bg-background border">
          <Icon className="size-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{fileName}</p>
          {fileSize && (
            <p className="text-xs text-muted-foreground">
              {formatFileSize(fileSize)}
            </p>
          )}
        </div>
        <DownloadIcon className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </NodeViewWrapper>
  );
}
