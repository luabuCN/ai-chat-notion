"use client";

import { useState } from "react";
import { toast } from "@/components/toast";
import { LoaderIcon, ImageIcon } from "./icons";
// 引入 shadcn 或现有 UI 库风格的简单文本框（如果项目中没有现成 Textarea，直接用 textarea 也可）

const MODELS = [
  { id: "Tongyi-MAI/Z-Image-Turbo", name: "Z-Image-Turbo" },
  { id: "MusePublic/489_ckpt_FLUX_1", name: "Flux 1" },
  { id: "MAILAND/majicflus_v1", name: "Majicflux v1" },
];

const SIZES = [
  { id: "1024x1024", name: "1:1", label: "1024x1024" },
  { id: "1024x768", name: "4:3", label: "1024x768" },
  { id: "768x1024", name: "3:4", label: "768x1024" },
];

export function ImageGenerationStudio() {
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [model, setModel] = useState(MODELS[0].id);
  const [size, setSize] = useState(SIZES[0].id);

  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({ type: "error", description: "请输入提示词" });
      return;
    }

    setIsGenerating(true);
    setResultImage(null);

    try {
      const res = await fetch("/api/image/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          negative_prompt: negativePrompt,
          size,
        }),
      });

      if (!res.ok) {
        throw new Error((await res.text()) || "请求失败");
      }

      const { task_id } = await res.json();

      const poll = async () => {
        const pollRes = await fetch(`/api/image/tasks/${task_id}`);
        if (!pollRes.ok) {
          throw new Error((await pollRes.text()) || "查询任务失败");
        }
        const data = await pollRes.json();

        if (data.task_status === "SUCCEED") {
          setResultImage(data.output_images[0]);
          setIsGenerating(false);
          toast({ type: "success", description: "图片生成成功！" });
        } else if (data.task_status === "FAILED") {
          setIsGenerating(false);
          toast({ type: "error", description: "图片生成失败" });
        } else {
          // PENDING or RUNNING
          setTimeout(poll, 3000);
        }
      };

      poll();
    } catch (err: any) {
      toast({ type: "error", description: err.message || "生成请求失败" });
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col md:flex-row overflow-hidden bg-background text-foreground">
      {/* 左侧控制栏 */}
      <div className="flex w-full md:w-80 flex-col border-r border-border bg-card p-6 gap-6 overflow-y-auto shrink-0 z-10">
        <div className="flex items-center gap-2 text-xl font-bold text-primary">
          <ImageIcon size={24} />
          <span>AI 创作工坊</span>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold">AI 模型</label>
          <select
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold">描述你想生成的图片</label>
          <textarea
            placeholder="详细描述你想要的图片，例如：一只可爱的猫咪趴在窗台上晒太阳，温暖的午后阳光，柔和的色调..."
            className="w-full min-h-[120px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={4000}
          />
          <div className="text-xs text-muted-foreground text-right">
            {prompt.length}/4000
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-muted-foreground">
            负向提示词 (可选)
          </label>
          <textarea
            placeholder="不希望在图片中出现的元素..."
            className="w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold">图片比例</label>
          <div className="grid grid-cols-3 gap-2">
            {SIZES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSize(s.id)}
                className={`flex flex-col items-center justify-center rounded-md border p-2 text-xs transition-colors ${
                  size === s.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-input bg-transparent hover:bg-muted"
                }`}
              >
                <div className="font-bold mb-1">{s.name}</div>
                <div className="text-[10px] opacity-80">{s.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto pt-4">
          <button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-10 rounded-md font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
          >
            {isGenerating ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin">
                  <LoaderIcon />
                </div>
                <span>开始创作...</span>
              </div>
            ) : (
              "✨ 开始创作"
            )}
          </button>
        </div>
      </div>

      {/* 右侧预览区 */}
      <div className="flex-1 flex flex-col items-center justify-center bg-muted/20 p-8 h-full overflow-hidden relative">
        {/* 顶部简单的状态栏/占位区 */}
        <div className="absolute top-0 left-0 right-0 h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center px-6 justify-between">
          <div className="flex items-center gap-4 text-sm font-medium">
            <span className="text-primary flex items-center gap-2">
              <ImageIcon size={16} /> 生成结果
            </span>
          </div>
        </div>

        <div className="w-full h-full pt-14 flex items-center justify-center">
          <div className="w-full max-w-3xl flex-1 flex flex-col items-center justify-center relative">
            {resultImage ? (
              <div className="flex flex-col items-center w-full h-full max-h-[80vh] justify-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resultImage}
                  alt="Generated outcome"
                  className="max-w-full max-h-full object-contain rounded-xl shadow-2xl ring-1 ring-border"
                />
                <button
                  onClick={() => window.open(resultImage, "_blank")}
                  className="text-sm px-4 py-2 bg-secondary text-secondary-foreground rounded shadow-sm hover:bg-secondary/80"
                >
                  在新窗口查看大图并下载
                </button>
              </div>
            ) : (
              <div className="text-center flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-2xl bg-card/50 text-muted-foreground w-full max-w-md aspect-square shadow-sm">
                {isGenerating ? (
                  <>
                    <div className="animate-spin text-primary mb-4">
                      <LoaderIcon size={48} />
                    </div>
                    <p className="text-lg font-medium text-foreground">
                      AI 正在努力绘制中
                    </p>
                    <p className="text-sm mt-2 opacity-80">
                      通常需要十几秒到一两分钟，请耐心等待...
                    </p>
                  </>
                ) : (
                  <>
                    <ImageIcon size={48} className="mb-4 opacity-20" />
                    <p className="text-lg font-medium text-foreground">
                      还没有作品，输入描述开始创作吧
                    </p>
                    <p className="text-sm mt-2 opacity-80">
                      以上模型由 ModelScope 提供
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
