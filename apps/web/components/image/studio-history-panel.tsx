import {
  Badge,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui";
import {
  History,
  Loader2,
  Info,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize,
  Maximize2,
  Download,
} from "lucide-react";
import { motion } from "framer-motion";
import { SIZES } from "./constants";
import type { HistoryItem } from "./types";
import { formatTime, getStatusLabel } from "./utils";
import { PhotoProvider, PhotoView } from "react-photo-view";

type StudioHistoryPanelProps = {
  history: HistoryItem[];
  isHistoryLoading: boolean;
  onSelectHistory: (item: HistoryItem) => void;
};

export function StudioHistoryPanel({
  history,
  isHistoryLoading,
  onSelectHistory,
}: StudioHistoryPanelProps) {
  return (
    <ScrollArea className="h-full">
      {isHistoryLoading ? (
        <div className="flex h-[320px] items-center justify-center text-zinc-500">
          <Loader2 className="mr-2 size-5 animate-spin" />
          {"正在加载历史记录..."}
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
            {"当前还没有图片历史"}
          </h3>
          <p className="mt-2 max-w-md text-sm text-zinc-500">
            {
              "生成完成后的图片会自动归档，并带上空间、角色和时间信息，方便团队追踪。"
            }
          </p>
        </motion.div>
      ) : (
        <PhotoProvider
          toolbarRender={({ index, scale, onScale, rotate, onRotate }) => {
            const validItems = history.filter((item) => item.outputImageUrl);
            const item = validItems[index];
            if (!item) return null;

            return (
              <div className="flex items-center gap-5 pr-4">
                <ZoomIn
                  className="size-5 cursor-pointer text-white/70 transition-colors hover:text-white"
                  onClick={() => onScale(scale + 0.5)}
                />
                <ZoomOut
                  className="size-5 cursor-pointer text-white/70 transition-colors hover:text-white"
                  onClick={() => onScale(scale - 0.5)}
                />
                <RotateCw
                  className="size-5 cursor-pointer text-white/70 transition-colors hover:text-white"
                  onClick={() => onRotate(rotate + 90)}
                />
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
                    <div className="flex items-center justify-center">
                      <Info className="size-5 cursor-pointer text-white/70 transition-colors hover:text-white" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    align="end"
                    className="z-[5000] w-80 rounded-xl border border-white/10 bg-zinc-900/95 p-4 text-left text-sm text-zinc-200 shadow-2xl backdrop-blur-md"
                  >
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-zinc-400">{"提示词"}</p>
                        <p className="mt-1 leading-relaxed">{item.prompt}</p>
                      </div>
                      {item.negativePrompt ? (
                        <div>
                          <p className="text-xs text-zinc-400">
                            {"负向提示词"}
                          </p>
                          <p className="mt-1 leading-relaxed">
                            {item.negativePrompt}
                          </p>
                        </div>
                      ) : null}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="min-w-0">
                          <p className="text-xs text-zinc-400">{"模型"}</p>
                          <p className="mt-1 truncate" title={item.model}>
                            {item.model}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-zinc-400">{"比例"}</p>
                          <p className="mt-1">
                            {SIZES.find((s) => s.id === item.size)?.name ||
                              item.size ||
                              "默认"}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-zinc-400">{"生成时间"}</p>
                          <p className="mt-1">{formatTime(item.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          }}
        >
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {history.map((item) => (
              <motion.article
                key={item.id}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
                className="group relative aspect-4/3 overflow-hidden rounded-[24px] border border-zinc-200 bg-zinc-100 shadow-sm cursor-pointer"
              >
                {item.outputImageUrl ? (
                  <>
                    <img
                      src={item.outputImageUrl}
                      alt={item.prompt}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute right-3 top-3 flex gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <PhotoView src={item.outputImageUrl}>
                        <button
                          type="button"
                          className="flex size-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/80"
                          title="查看详情"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Maximize2 className="size-4" />
                        </button>
                      </PhotoView>
                      <a
                        href={item.outputImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex size-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/80"
                        title="下载图片"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download className="size-4" />
                      </a>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center px-6 text-center text-sm text-zinc-500">
                    {item.status === "FAILED" ? (
                      item.errorMessage || "生成失败"
                    ) : (
                      <>
                        <Loader2 className="mb-2 size-6 animate-spin" />
                        <span className="text-xs">{"生成中..."}</span>
                      </>
                    )}
                  </div>
                )}
              </motion.article>
            ))}
          </div>
        </PhotoProvider>
      )}
    </ScrollArea>
  );
}
