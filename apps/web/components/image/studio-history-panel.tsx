import {
  ImagePreview,
  PhotoView,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  Button,
} from "@repo/ui";
import {
  AlertCircle,
  History,
  Info,
  Loader2,
  Maximize,
  Download,
  Trash2,
  Pause,
} from "lucide-react";
import { motion } from "framer-motion";
import { SIZES } from "./constants";
import type { HistoryItem } from "./types";
import { formatTime } from "./utils";

function isGeneratingItem(item: HistoryItem) {
  return !item.outputImageUrl && item.status !== "FAILED";
}

type StudioHistoryPanelProps = {
  history: HistoryItem[];
  isHistoryLoading: boolean;
  onDeleteHistory?: (item: HistoryItem) => void;
  onPauseGeneration?: (item: HistoryItem) => void;
  deletingHistoryId?: string | null;
  pausingTaskId?: string | null;
};

export function StudioHistoryPanel({
  history,
  isHistoryLoading,
  onDeleteHistory,
  onPauseGeneration,
  deletingHistoryId,
  pausingTaskId,
}: StudioHistoryPanelProps) {
  return (
    <ScrollArea className="h-full">
      {isHistoryLoading ? (
        <div className="flex h-[320px] items-center justify-center text-zinc-500">
          <Loader2 className="mr-2 size-5 animate-spin" />
          正在加载历史记录...
        </div>
      ) : history.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex h-[320px] flex-col items-center justify-center rounded-[28px] border border-dashed border-zinc-300 bg-zinc-50 text-center"
        >
          <History className="size-12 text-zinc-400" />
          <h3 className="mt-4 text-xl font-semibold text-zinc-950">
            当前还没有图片历史
          </h3>
          <p className="mt-2 max-w-md text-sm text-zinc-500">
            生成完成后的图片会自动归档，并带上空间、角色和时间信息，方便团队追踪。
          </p>
        </motion.div>
      ) : (
        <ImagePreview
          toolbarRender={({ index }) => {
            const validItems = history.filter((item) => item.outputImageUrl);
            const item = validItems[index];
            if (!item) return null;

            return (
              <>
                <Maximize
                  className="size-5 cursor-pointer text-white/70 transition-colors hover:text-white"
                  onClick={() => {
                    if (document.fullscreenElement) {
                      document.exitFullscreen();
                    } else {
                      document.documentElement.requestFullscreen();
                    }
                  }}
                />
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-center pl-4">
                      <Info className="size-5 cursor-pointer text-white/70 transition-colors hover:text-white" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    align="end"
                    className="z-5000 w-80 rounded-xl border border-white/10 bg-zinc-900/95 p-4 text-left text-sm text-zinc-200 shadow-2xl backdrop-blur-md"
                  >
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-zinc-400">提示词</p>
                        <p className="mt-1.5 leading-relaxed">{item.prompt}</p>
                      </div>
                      {item.negativePrompt ? (
                        <div>
                          <p className="text-xs text-zinc-400">负向提示词</p>
                          <p className="mt-1.5 leading-relaxed">
                            {item.negativePrompt}
                          </p>
                        </div>
                      ) : null}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        <div className="min-w-0">
                          <p className="text-xs text-zinc-400">模型</p>
                          <p className="mt-1.5 truncate" title={item.model}>
                            {item.model}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-zinc-400">比例</p>
                          <p className="mt-1.5">
                            {SIZES.find((s) => s.id === item.size)?.name ||
                              item.size ||
                              "默认"}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-zinc-400">生成时间</p>
                          <p className="mt-1.5">{formatTime(item.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </>
            );
          }}
        >
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {history.map((item) => (
              <motion.article
                key={item.id}
                whileHover={item.outputImageUrl ? { scale: 1.02 } : undefined}
                transition={{ duration: 0.2 }}
                className={`group relative aspect-4/3 overflow-hidden rounded-[24px] border border-zinc-200 bg-zinc-100 shadow-sm ${
                  item.outputImageUrl ? "cursor-zoom-in" : "cursor-default"
                }`}
              >
                {item.outputImageUrl ? (
                  <>
                    <PhotoView src={item.outputImageUrl}>
                      <img
                        src={item.outputImageUrl}
                        alt={item.prompt}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </PhotoView>
                    <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/20 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                    <div className="absolute right-3 top-3 flex gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <a
                        href={item.outputImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="pointer-events-auto flex size-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/80"
                        title="下载图片"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Download className="size-4" />
                      </a>
                    </div>
                  </>
                ) : item.status === "FAILED" ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
                    <AlertCircle className="size-8 text-red-400" />
                    <span className="text-xs font-medium text-red-600">
                      生成失败
                    </span>
                    <p className="line-clamp-2 text-[11px] leading-5 text-zinc-500">
                      {item.errorMessage || "图片生成失败"}
                    </p>
                    {onDeleteHistory ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-full px-3 text-xs"
                        disabled={deletingHistoryId === item.id}
                        onClick={() => onDeleteHistory(item)}
                      >
                        <Trash2 className="size-3" />
                        {deletingHistoryId === item.id ? "删除中" : "删除"}
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center text-sm text-zinc-500">
                    <Loader2 className="size-6 animate-spin" />
                    <span className="text-xs">生成中...</span>
                    {onPauseGeneration && item.providerTaskId ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-full px-3 text-xs"
                        disabled={pausingTaskId === item.providerTaskId}
                        onClick={() => onPauseGeneration(item)}
                      >
                        <Pause className="size-3" />
                        {pausingTaskId === item.providerTaskId
                          ? "暂停中"
                          : "暂停"}
                      </Button>
                    ) : null}
                  </div>
                )}
              </motion.article>
            ))}
          </div>
        </ImagePreview>
      )}
    </ScrollArea>
  );
}
