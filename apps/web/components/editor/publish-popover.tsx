"use client";

import { useState } from "react";
import { usePublishDocument } from "@/hooks/use-document-query";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui";
import { Button } from "@repo/ui";
import { Globe, Check, Copy, Send } from "lucide-react";
import { toast } from "sonner";

interface PublishPopoverProps {
  documentId: string;
  isPublished: boolean;
}

export function PublishPopover({
  documentId,
  isPublished,
}: PublishPopoverProps) {
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const publishMutation = usePublishDocument();

  const url = `${
    typeof window !== "undefined" ? window.location.origin : ""
  }/preview/${documentId}`;

  const onPublish = () => {
    setIsSubmitting(true);
    publishMutation.mutate(
      { documentId, publish: true },
      {
        onSuccess: () => {
          setIsSubmitting(false);
          toast.success("文档已公开发布");
        },
        onError: () => {
          setIsSubmitting(false);
          toast.error("发布失败");
        },
      }
    );
  };

  const onUnpublish = () => {
    setIsSubmitting(true);
    publishMutation.mutate(
      { documentId, publish: false },
      {
        onSuccess: () => {
          setIsSubmitting(false);
          toast.success("文档已取消发布");
        },
        onError: () => {
          setIsSubmitting(false);
          toast.error("取消发布失败");
        },
      }
    );
  };

  const onCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
    toast.success("链接已复制");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-muted-foreground gap-2"
        >
          {isPublished ? (
            <>
              <Globe className="h-4 w-4 text-sky-500" />
              <span className="text-sky-500 font-medium">Published</span>
            </>
          ) : (
            <>
              <span className="text-xs">Publish</span>
              <Send className="h-4 w-4" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end" alignOffset={8} forceMount>
        {isPublished ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="h-4 w-4 text-sky-500 animate-pulse" />
              <p className="text-xs font-medium text-sky-500">
                This note is live on the web.
              </p>
            </div>
            <div className="flex items-center">
              <input
                className="flex-1 px-2 text-xs border rounded-l-md h-8 bg-muted truncate"
                value={url}
                disabled
              />
              <Button
                onClick={onCopy}
                disabled={copied}
                className="h-8 rounded-l-none"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Button
              size="sm"
              className="w-full text-xs"
              disabled={isSubmitting}
              onClick={onUnpublish}
            >
              Unpublish
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <Globe className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium mb-2">Publish this note</p>
            <span className="text-xs text-muted-foreground mb-4">
              Share your work with others.
            </span>
            <Button
              disabled={isSubmitting}
              onClick={onPublish}
              className="w-full text-xs"
              size="sm"
            >
              Publish
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
