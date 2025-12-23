"use client";

import { useState } from "react";
import { Download, Printer, FileIcon, Loader2 } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui";
import { useGetDocument } from "@/hooks/use-document-query";
import { useEditorExport } from "@repo/editor";

interface ExportMenuProps {
  documentId: string;
  title: string;
}

export function ExportMenu({ documentId, title }: ExportMenuProps) {
  const { data: document } = useGetDocument(documentId);
  const { exportDocument } = useEditorExport();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: "markdown" | "pdf") => {
    if (!document?.content) return;

    try {
      setIsExporting(true);
      const content = JSON.parse(document.content);

      await exportDocument(content, title, format);
    } catch (error) {
      console.error(`Failed to export ${format}:`, error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("markdown")}>
          <FileIcon className="mr-2 h-4 w-4" />
          导出 Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pdf")}>
          <Printer className="mr-2 h-4 w-4" />
          导出 PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
