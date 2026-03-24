"use client";

import { useEffect, useState } from "react";
import {
  getConvertTask,
  subscribeConvertTask,
  type ConvertTask,
} from "@/lib/pdf/convert-store";

interface PdfConvertingOverlayProps {
  documentId: string;
}

export function PdfConvertingOverlay({ documentId }: PdfConvertingOverlayProps) {
  const [task, setTask] = useState<ConvertTask | undefined>(() =>
    getConvertTask(documentId)
  );

  useEffect(() => {
    setTask(getConvertTask(documentId));
    return subscribeConvertTask(documentId, setTask);
  }, [documentId]);

  if (!task || task.status === "done" || task.status === "error") return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/90 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 max-w-sm text-center">
        <div className="size-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <p className="text-sm font-medium text-foreground">{task.progress}</p>
        <p className="text-xs text-muted-foreground">
          正在后台处理，切换文档不会中断
        </p>
      </div>
    </div>
  );
}
