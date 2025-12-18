import { Button } from "@repo/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Input } from "@repo/ui/input";
import {
  LinkIcon,
  Loader2Icon,
  UploadCloudIcon,
  UploadIcon,
} from "lucide-react";
import { useRef, useState } from "react";

export type UploadType = "image" | "attachment";

interface UploadDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  type: UploadType;
  uploadFile?: (file: File) => Promise<string>;
  onInsert: (
    url: string,
    fileName?: string,
    fileSize?: number,
    fileType?: string
  ) => void;
}

export function UploadDialog({
  isOpen,
  onOpenChange,
  type,
  uploadFile,
  onInsert,
}: UploadDialogProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "url">("upload");
  const [url, setUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUrlSubmit = () => {
    if (!url.trim()) return;
    const fileName = url.split("/").pop() || "attachment";
    onInsert(url, fileName);
    setUrl("");
    onOpenChange(false);
  };

  const handleFileUpload = async (file: File) => {
    if (!uploadFile) return;

    setIsUploading(true);
    try {
      const uploadedUrl = await uploadFile(file);
      onInsert(uploadedUrl, file.name, file.size, file.type);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to upload file:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (type === "image" && !file.type.startsWith("image/")) {
        return;
      }
      handleFileUpload(file);
    }
  };

  const title = type === "image" ? "Insert Image" : "Insert Attachment";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 pt-3 border-b">
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`px-3 py-2 text-sm transition-colors relative ${
              activeTab === "upload"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <UploadIcon className="size-4" />
              Upload
            </span>
            {activeTab === "upload" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("url")}
            className={`px-3 py-2 text-sm transition-colors relative ${
              activeTab === "url"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <LinkIcon className="size-4" />
              Embed URL
            </span>
            {activeTab === "url" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {activeTab === "upload" && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={type === "image" ? "image/*" : undefined}
                className="hidden"
                onChange={handleFileChange}
              />
              <div
                onClick={() => !isUploading && fileInputRef.current?.click()}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`
                  flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                  ${
                    dragActive
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-muted-foreground/50"
                  }
                  ${isUploading ? "pointer-events-none opacity-60" : ""}
                `}
              >
                {isUploading ? (
                  <>
                    <Loader2Icon className="size-10 text-muted-foreground animate-spin" />
                    <p className="text-sm text-muted-foreground">
                      Uploading...
                    </p>
                  </>
                ) : (
                  <>
                    <UploadCloudIcon className="size-10 text-muted-foreground" />
                    <div className="text-center">
                      <p className="text-sm font-medium">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {type === "image"
                          ? "PNG, JPG, GIF up to 10MB"
                          : "Any file up to 10MB"}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {activeTab === "url" && (
            <div className="flex flex-col gap-4">
              <Input
                placeholder={
                  type === "image"
                    ? "https://example.com/image.png"
                    : "https://example.com/file.pdf"
                }
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleUrlSubmit();
                  }
                }}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUrlSubmit} disabled={!url.trim()}>
                  Embed
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
