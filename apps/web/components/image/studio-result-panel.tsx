import { Download, ImagePlus, Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { PhotoProvider, PhotoView } from "react-photo-view";

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
      <div className="flex h-full w-full flex-col overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm">
        {resultImage ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[24px] bg-zinc-50/50 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-size-[16px_16px] p-6 lg:p-12"
          >
            {/* 背景柔光模糊 */}
            <div className="absolute left-1/2 top-1/2 -z-10 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-200/50 blur-[100px]" />

            <div className="group relative aspect-square h-full max-h-full w-full max-w-[800px] overflow-hidden rounded-[24px] border border-zinc-200/60 bg-white shadow-xl ring-1 ring-zinc-900/5 transition-all hover:shadow-2xl">
              <PhotoProvider>
                <PhotoView src={resultImage}>
                  <img
                    src={resultImage}
                    alt="Generated outcome"
                    className="h-full w-full cursor-zoom-in object-contain transition-transform duration-700 group-hover:scale-[1.02]"
                  />
                </PhotoView>
              </PhotoProvider>

              <div className="absolute right-5 top-5 flex -translate-y-2 gap-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                <a
                  href={resultImage}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-10 items-center justify-center gap-2 rounded-full bg-white/90 px-4 text-sm font-medium text-zinc-700 shadow-sm backdrop-blur-md transition hover:bg-white hover:text-black hover:shadow-md"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download className="size-4" />
                  保存高清原图
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
                  {/* 左上角蓝色四芒星 */}
                  <div className="absolute -left-5 -top-5 z-10 hidden sm:block">
                    <motion.svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="size-10 text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                      animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <path
                        d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4772 12 22C12 16.4772 16.4772 12 22 12C16.4772 12 12 7.52285 12 2Z"
                        fill="currentColor"
                      />
                    </motion.svg>
                  </div>
                  <div className="absolute -left-4 -top-4 z-10 sm:hidden">
                    <motion.svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="size-8 text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                      animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <path
                        d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4772 12 22C12 16.4772 16.4772 12 22 12C16.4772 12 12 7.52285 12 2Z"
                        fill="currentColor"
                      />
                    </motion.svg>
                  </div>

                  {/* 骨架屏方形背景与扫光 */}
                  <div className="relative h-full w-full overflow-hidden rounded-[24px] bg-zinc-100/60 ring-1 ring-zinc-200 shadow-sm">
                    {/* 增强骨架屏的白色扫光区域 - 使用更白且更宽的光束并缩短周期 */}
                    <motion.div
                      className="absolute inset-0 w-[150%] bg-linear-to-r from-transparent via-white to-transparent skew-x-[-20deg]"
                      initial={{ left: "-150%" }}
                      animate={{ left: "150%" }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.2,
                        ease: "easeInOut",
                      }}
                    />
                  </div>
                </div>

                <h3 className="text-xl font-semibold tracking-tight text-zinc-950">
                  {"正在生成中..."}
                </h3>
                <div className="mt-4 flex items-center justify-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-sm text-zinc-500">
                  <Loader2 className="size-4 animate-spin text-zinc-600" />
                  <span>{"绘制细节并同步至素材库"}</span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center"
              >
                <div className="flex size-20 items-center justify-center rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm">
                  <ImagePlus className="size-9 text-zinc-300" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-zinc-950">
                  {"还没有生成任何图片"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  {"在左侧填写描述、选择风格和参数，点击「开始创作」即可生成"}
                </p>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
