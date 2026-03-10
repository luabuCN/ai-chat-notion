import { Badge, Button, ScrollArea } from "@repo/ui";
import { History, Loader2 } from "lucide-react";
import { SIZES } from "./constants";
import type { HistoryItem } from "./types";
import { formatTime, getStatusLabel } from "./utils";

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
        <div className="flex h-[320px] flex-col items-center justify-center rounded-[28px] border border-dashed border-zinc-300 bg-zinc-50 text-center">
          <History className="size-12 text-zinc-400" />
          <h3 className="mt-4 text-xl font-semibold text-zinc-950">
            {"当前还没有图片历史"}
          </h3>
          <p className="mt-2 max-w-md text-sm text-zinc-500">
            {
              "生成完成后的图片会自动归档，并带上空间、角色和时间信息，方便团队追踪。"
            }
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {history.map((item) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm"
            >
              <div className="aspect-[4/3] overflow-hidden bg-zinc-100">
                {item.outputImageUrl ? (
                  <img
                    src={item.outputImageUrl}
                    alt={item.prompt}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-500">
                    {item.status === "FAILED" ? (
                      item.errorMessage || "生成失败"
                    ) : (
                      <Loader2 className="size-6 animate-spin" />
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-4 p-5">
                <div className="flex flex-wrap gap-2">
                  <Badge className="border border-zinc-200 bg-zinc-50 text-zinc-700">
                    {getStatusLabel(item.status)}
                  </Badge>
                </div>
                <div>
                  <h3 className="line-clamp-2 text-lg font-semibold text-zinc-950">
                    {item.prompt}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-500">
                    {"比例 "}
                    {SIZES.find((s) => s.id === item.size)?.name ||
                      item.size ||
                      "默认"}
                    {" · "}
                    {formatTime(item.createdAt)}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-100"
                    onClick={() => onSelectHistory(item)}
                  >
                    {"查看详情"}
                  </Button>
                  {item.outputImageUrl ? (
                    <a
                      href={item.outputImageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 flex-1 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-100"
                    >
                      {"下载图片"}
                    </a>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </ScrollArea>
  );
}
