import { Button } from "@repo/ui";
import { Download, ImagePlus, Loader2 } from "lucide-react";

type StudioResultPanelProps = {
  resultImage: string | null;
  isGenerating: boolean;
};

export function StudioResultPanel({
  resultImage,
  isGenerating,
}: StudioResultPanelProps) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center">
      <div className="flex h-full w-full flex-col overflow-hidden rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
        {resultImage ? (
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[24px] border border-zinc-200 bg-zinc-100 p-6">
            <div className="relative aspect-square h-full max-h-full w-full max-w-[720px] overflow-hidden rounded-[20px] border border-zinc-200 bg-white shadow-sm">
              <img
                src={resultImage}
                alt="Generated outcome"
                className="h-full w-full object-contain"
              />
              <a
                href={resultImage}
                target="_blank"
                rel="noreferrer"
                className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/90 text-zinc-700 shadow-sm backdrop-blur-sm transition hover:bg-white hover:text-black hover:shadow-md"
                title="下载原图"
              >
                <Download className="size-5" />
              </a>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex size-20 items-center justify-center rounded-2xl bg-zinc-100">
              {isGenerating ? (
                <Loader2 className="size-9 animate-spin text-zinc-400" />
              ) : (
                <ImagePlus className="size-9 text-zinc-400" />
              )}
            </div>
            <h3 className="mt-5 text-lg font-semibold text-zinc-950">
              {isGenerating ? "正在绘制并同步到素材库" : "还没有生成任何图片"}
            </h3>
            <p className="mt-2  text-sm leading-6 text-zinc-500">
              {isGenerating
                ? "持续轮询任务状态，成功后自动上传并写入历史记录。"
                : "在左侧填写描述、选择风格和参数，点击「开始创作」即可生成"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
