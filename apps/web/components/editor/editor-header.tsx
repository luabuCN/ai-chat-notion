"use client";

import { SidebarToggle } from "@/components/sidebar-toggle";
import {
  useSidebar,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Separator,
} from "@repo/ui";
import { useWindowSize } from "usehooks-ts";
import { useUpdateDocument } from "@/hooks/use-document-query";
import { useState } from "react";
import {
  Share,
  Clock,
  Star,
  MoreHorizontal,
  MessageSquare,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { LanguageSwitcher } from "../language-switcher";
import { cn } from "@/lib/utils";
import { PublishPopover } from "./publish-popover";
import { DocumentActionsMenu } from "./document-actions-menu";

interface EditorHeaderProps {
  locale: string;
  documentTitle?: string;
  documentIcon?: string | null;
  documentId: string;
  isPublished?: boolean;
  isFavorite?: boolean;
  isSaving?: boolean;
  isSaved?: boolean;
}

export function EditorHeader({
  locale,
  documentTitle,
  documentIcon,
  documentId,
  isPublished = false,
  isFavorite = false,
  isSaving = false,
  isSaved = false,
}: EditorHeaderProps) {
  const { open } = useSidebar();
  const { width: windowWidth } = useWindowSize();
  const updateDocumentMutation = useUpdateDocument();
  const [isUpdatingFavorite, setIsUpdatingFavorite] = useState(false);

  const toggleFavorite = () => {
    if (isUpdatingFavorite) return;
    setIsUpdatingFavorite(true);
    updateDocumentMutation.mutate(
      {
        documentId,
        updates: { isFavorite: !isFavorite },
      },
      {
        onSettled: () => setIsUpdatingFavorite(false),
      }
    );
  };

  return (
    <header className="flex items-center justify-between px-4 h-14 border-b shrink-0 gap-2">
      <div className="flex items-center gap-2">
        {(!open || windowWidth < 768) && (
          <SidebarToggle className="" variant="ghost" />
        )}
        <div className="flex items-center gap-2 px-2">
          <div className="p-1 bg-muted rounded-sm flex items-center justify-center min-w-[24px] min-h-[24px]">
            {isSaving ? (
              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
            ) : isSaved ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : documentIcon ? (
              <span className="text-base leading-none">{documentIcon}</span>
            ) : null}
          </div>
          <h1 className="font-semibold text-sm truncate">
            {documentTitle || "未命名"}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {/* <div className="flex items-center -space-x-2 mr-2">
          <Avatar className="h-7 w-7 border-2 border-background">
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
          <Avatar className="h-7 w-7 border-2 border-background">
            <AvatarImage src="https://github.com/vercel.png" />
            <AvatarFallback>VC</AvatarFallback>
          </Avatar>
          <div className="h-7 w-7 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
            +3
          </div>
        </div> */}

        {/* <Separator orientation="vertical" className="h-6 mx-2" /> */}
        <PublishPopover documentId={documentId} isPublished={isPublished} />

        {/* <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
        >
          <Clock className="h-4 w-4" />
        </Button> */}

        {/* <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
        >
          <MessageSquare className="h-4 w-4" />
        </Button> */}

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          onClick={toggleFavorite}
          disabled={isUpdatingFavorite}
        >
          <Star
            className={cn(
              "h-4 w-4 transition-colors",
              isFavorite && "fill-yellow-400 text-yellow-400"
            )}
          />
        </Button>

        <DocumentActionsMenu
          documentId={documentId}
          title={documentTitle || "Untitled"}
        />
      </div>
    </header>
  );
}
