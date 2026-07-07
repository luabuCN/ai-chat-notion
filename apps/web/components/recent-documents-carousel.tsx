"use client";

import { motion } from "framer-motion";
import { Clock3, FileText } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@repo/ui";
import { useAllDocuments, type AllDocumentItem } from "@/hooks/use-document-query";
import { useWorkspace } from "@/components/workspace-provider";
import { cn } from "@/lib/utils";

/** 每次点击箭头滚动的卡片数量 */
const SCROLL_STEP = 3;

const DEFAULT_COVERS = [
  "linear-gradient(135deg, #f5f0e6 0%, #ebe4d4 100%)",
  "linear-gradient(135deg, #fce8e8 0%, #f5d4d4 100%)",
  "linear-gradient(135deg, #e8f0fc 0%, #d4e4f5 100%)",
  "linear-gradient(135deg, #eef5e8 0%, #dcebd4 100%)",
  "linear-gradient(135deg, #f3e8fc 0%, #e4d4f5 100%)",
];

function hashString(value: string): number {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) % 1_000_000;
  }
  return hash;
}

function formatDocumentDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));

  if (diffWeeks >= 1 && diffWeeks < 8) {
    return `${diffWeeks} 周前`;
  }

  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (date.getFullYear() === now.getFullYear()) {
    return `${month}月${day}日`;
  }

  return `${date.getFullYear()}年${month}月${day}日`;
}

function buildEditorPath(documentId: string, workspaceSlug?: string) {
  return workspaceSlug
    ? `/${workspaceSlug}/editor/${documentId}`
    : `/editor/${documentId}`;
}

function isColorCover(
  coverImage: string | null | undefined,
  coverImageType?: "color" | "url" | null
) {
  if (!coverImage) {
    return false;
  }

  return (
    coverImageType === "color" ||
    coverImage.startsWith("linear-gradient") ||
    coverImage.startsWith("#")
  );
}

function DocumentCarouselCard({
  document,
  workspaceSlug,
}: {
  document: AllDocumentItem;
  workspaceSlug?: string;
}) {
  const fallbackCover =
    DEFAULT_COVERS[hashString(document.id) % DEFAULT_COVERS.length];
  const hasCover = Boolean(document.coverImage);
  const useColorCover = isColorCover(
    document.coverImage,
    document.coverImageType
  );

  return (
    <Link
      className="group/card block h-full"
      href={buildEditorPath(document.id, workspaceSlug)}
    >
      <article className="flex h-[168px] flex-col overflow-hidden rounded-lg bg-muted/60 transition-colors hover:bg-muted/35">
        <div className="relative h-[72px] shrink-0 overflow-hidden">
          {hasCover && useColorCover ? (
            <div
              className="h-full w-full"
              style={{ background: document.coverImage ?? undefined }}
            />
          ) : null}
          {hasCover && !useColorCover ? (
            <Image
              alt=""
              className="object-cover"
              fill
              src={document.coverImage ?? ""}
              style={{
                objectPosition: `center ${document.coverImagePosition ?? 50}%`,
              }}
              unoptimized
            />
          ) : null}
          {!hasCover ? (
            <div
              className="h-full w-full"
              style={{ background: fallbackCover }}
            />
          ) : null}
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col px-3 pb-3 pt-5">
          <div className="absolute -top-5 left-4 flex size-9 items-center justify-center rounded-md bg-background">
            {document.icon ? (
              <span className="text-base leading-none">{document.icon}</span>
            ) : (
              <FileText className="size-4 text-muted-foreground" />
            )}
          </div>

          <h3 className="line-clamp-2 text-left font-medium text-[13px] leading-5 text-foreground">
            {document.title || "无标题"}
          </h3>

          <div className="mt-auto flex items-center gap-1.5 pt-2 text-[11px] text-muted-foreground">
            <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
              <Clock3 className="size-2.5" />
            </span>
            <span>{formatDocumentDate(document.updatedAt)}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}

function CarouselSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          className="flex h-[168px] w-[168px] shrink-0 flex-col overflow-hidden rounded-lg bg-muted/25"
          key={index}
        >
          <div className="h-[72px] shrink-0 animate-pulse bg-muted/50" />
          <div className="relative flex min-h-0 flex-1 flex-col px-3 pb-3 pt-5">
            <div className="absolute -top-5 left-4 size-9 animate-pulse rounded-md bg-muted/50" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted/50" />
            <div className="mt-auto h-3 w-1/2 animate-pulse rounded bg-muted/50" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RecentDocumentsCarousel({
  workspaceSlug,
}: {
  workspaceSlug?: string;
}) {
  const { currentWorkspace, isLoading: isWorkspaceLoading } = useWorkspace();
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const { data, isLoading } = useAllDocuments(currentWorkspace?.id, undefined, {
    flat: true,
    sources: "workspace",
    limit: 12,
    enabled: Boolean(currentWorkspace?.id) && !isWorkspaceLoading,
  });

  const updateScrollShadows = useCallback((api: CarouselApi) => {
    if (!api) {
      return;
    }

    setCanScrollPrev(api.canScrollPrev());
    setCanScrollNext(api.canScrollNext());
  }, []);

  const scrollBySteps = useCallback(
    (direction: -1 | 1) => {
      if (!carouselApi) {
        return;
      }

      const snapCount = carouselApi.scrollSnapList().length;
      const current = carouselApi.selectedScrollSnap();
      const target =
        direction < 0
          ? Math.max(current - SCROLL_STEP, 0)
          : Math.min(current + SCROLL_STEP, snapCount - 1);

      carouselApi.scrollTo(target);
    },
    [carouselApi]
  );

  useEffect(() => {
    if (!carouselApi) {
      return;
    }

    updateScrollShadows(carouselApi);
    carouselApi.on("select", updateScrollShadows);
    carouselApi.on("reInit", updateScrollShadows);

    return () => {
      carouselApi.off("select", updateScrollShadows);
      carouselApi.off("reInit", updateScrollShadows);
    };
  }, [carouselApi, updateScrollShadows]);

  const recentDocuments = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.filter((doc) => doc.source === "workspace" && !doc.deletedAt);
  }, [data]);

  if (!isLoading && recentDocuments.length === 0) {
    return null;
  }

  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
      exit={{ opacity: 0, y: 12 }}
      initial={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.28, ease: "easeOut", delay: 0.04 }}
    >
      <div className="mb-3 flex items-center gap-2 px-0.5">
        <Clock3 className="size-4 text-muted-foreground" />
        <h2 className="font-medium text-[15px] text-foreground">最近访问</h2>
      </div>

      <div className="group relative">
        {isLoading ? (
          <CarouselSkeleton />
        ) : (
          <Carousel
            className="w-full"
            opts={{
              align: "start",
              dragFree: true,
            }}
            setApi={setCarouselApi}
          >
            <CarouselContent className="-ml-3">
              {recentDocuments.map((document) => (
                <CarouselItem
                  className="basis-[168px] pl-3"
                  key={document.id}
                >
                  <DocumentCarouselCard
                    document={document}
                    workspaceSlug={workspaceSlug}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>

            <CarouselPrevious
              className={cn(
                "absolute -left-4 top-1/2 z-20 size-8 -translate-y-1/2 border-0 bg-muted/40 opacity-0 shadow-none transition-opacity duration-200 hover:bg-muted/60",
                canScrollPrev ? "group-hover:opacity-100" : "hidden"
              )}
              onClick={() => scrollBySteps(-1)}
              type="button"
              variant="outline"
            />
            <CarouselNext
              className={cn(
                "absolute -right-4 top-1/2 z-20 size-8 -translate-y-1/2 border-0 bg-muted/40 opacity-0 shadow-none transition-opacity duration-200 hover:bg-muted/60",
                canScrollNext ? "group-hover:opacity-100" : "hidden"
              )}
              onClick={() => scrollBySteps(1)}
              type="button"
              variant="outline"
            />
          </Carousel>
        )}

        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-linear-to-r from-background via-background/80 to-transparent opacity-0 transition-opacity duration-200",
            canScrollPrev && "opacity-100"
          )}
        />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-linear-to-l from-background via-background/80 to-transparent opacity-0 transition-opacity duration-200",
            canScrollNext && "opacity-100"
          )}
        />
      </div>
    </motion.section>
  );
}
