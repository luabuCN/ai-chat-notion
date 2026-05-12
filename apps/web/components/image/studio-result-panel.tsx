import { ImagePreview } from "@repo/ui";
import { Download, ImagePlus, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

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
      <div className="flex h-full w-full flex-col overflow-hidden">
        {resultImage ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-zinc-50 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-size-[16px_16px]"
          >
            <div className="group relative aspect-square h-full max-h-full w-full max-w-[800px] overflow-hidden rounded-2xl">
              <ImagePreview src={resultImage}>
                <img
                  src={resultImage}
                  alt="Generated outcome"
                  className="h-full w-full cursor-zoom-in object-contain transition-transform duration-700 group-hover:scale-[1.02]"
                />
              </ImagePreview>

              {/* 下载按钮 - hover 时显示 */}
              <div className="absolute right-4 top-4 flex -translate-y-1 gap-2 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                <a
                  href={resultImage}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 items-center justify-center gap-1.5 rounded-full bg-white/90 px-3.5 text-sm font-medium text-zinc-700 shadow-sm backdrop-blur-sm transition hover:bg-white hover:text-black"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download className="size-3.5" />
                  保存原图
                </a>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            {isGenerating ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex w-full flex-col items-center px-6"
              >
                <div className="relative mb-8 aspect-square w-full max-w-[400px]">
                  {/* 骨架屏 */}
                  <div className="relative h-full w-full overflow-hidden rounded-2xl bg-zinc-100">
                    <motion.div
                      className="absolute inset-0 w-[150%] bg-linear-to-r from-transparent via-white/80 to-transparent skew-x-[-20deg]"
                      initial={{ left: "-150%" }}
                      animate={{ left: "150%" }}
                      transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                    />
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-zinc-900">{"正在生成中..."}</h3>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center"
              >
                <div className="flex size-16 items-center justify-center rounded-2xl bg-zinc-100">
                  <ImagePlus className="size-7 text-zinc-400" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-zinc-900">
                  {"还没有生成任何图片"}
                </h3>
                <p className="mt-1.5 max-w-xs text-sm leading-6 text-zinc-400">
                  {"填写描述后点击「开始创作」即可生成"}
                </p>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
