import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@repo/ui";
import {
  Camera,
  Loader2,
  PanelLeft,
  Palette,
  Image,
  Settings2,
  Sparkles,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MODELS,
  NEGATIVE_OPTIONS,
  PROMPT_LIBRARY,
  PROMPT_TEMPLATES,
  SIZES,
} from "./constants";
import type { PromptOptions } from "./types";

// 图片比例展示矩形的宽高配置
const RATIO_SHAPES: Record<string, { w: number; h: number }> = {
  "1:1": { w: 22, h: 22 },
  "4:3": { w: 24, h: 18 },
  "3:4": { w: 18, h: 24 },
  "16:9": { w: 28, h: 16 },
  "9:16": { w: 14, h: 24 },
  "2:3": { w: 16, h: 24 },
  "3:2": { w: 24, h: 16 },
  "21:9": { w: 28, h: 12 },
};

// 增强提示词各分类对应的图标
const PROMPT_GROUP_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  styles: Palette,
  scenes: Image,
  lighting: Sun,
  camera: Camera,
  quality: Sparkles,
};

type StudioSidebarProps = {
  currentWorkspaceName?: string | null;
  role: string;
  permission?: string | null;
  model: string;
  prompt: string;
  negativePrompt: string;
  size: string;
  promptOptions: PromptOptions;
  isGenerating: boolean;
  canCreate: boolean;
  onModelChange: (value: string) => void;
  onPromptChange: (value: string) => void;
  onNegativePromptChange: (value: string) => void;
  onSizeChange: (value: string) => void;
  onTogglePromptOption: (
    group: keyof PromptOptions,
    value: string,
    target?: "prompt" | "negative"
  ) => void;
  onApplyTemplate: (template: string) => void;
  onGenerate: () => void;
};

export function StudioSidebar({
  currentWorkspaceName,
  model,
  prompt,
  negativePrompt,
  size,
  promptOptions,
  isGenerating,
  canCreate,
  onModelChange,
  onPromptChange,
  onNegativePromptChange,
  onSizeChange,
  onTogglePromptOption,
  onApplyTemplate,
  onGenerate,
}: StudioSidebarProps) {
  return (
    <aside className="flex h-full w-full flex-col border-b border-zinc-200 bg-white xl:w-[380px] xl:border-b-0 xl:border-r">
      <div className="p-5 pb-0 md:p-6 md:pb-0">
        <section className="rounded-2xl border border-zinc-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50">
              <Sparkles className="size-4 text-zinc-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-950">
                {"AI 创作工坊"}
              </p>
              <p className="text-xs text-zinc-500">
                {currentWorkspaceName
                  ? `当前空间：${currentWorkspaceName}`
                  : "为当前空间生成可追踪的视觉素材"}
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-5 p-5 md:p-6">
          {/* 描述 + 模型 + 图片比例 + 增强提示词（合并为一个区域） */}
          <section className="space-y-5 rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
            {/* AI 模型选择器 */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-zinc-950">{"AI 模型"}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {"选择适合当前视觉风格的出图引擎"}
                </p>
              </div>
              <Select value={model} onValueChange={onModelChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <div className="flex items-center gap-2">
                        <span>{item.name}</span>
                        <Badge className="border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 hover:bg-zinc-200">
                          {item.badge}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* 描述输入 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-zinc-950">
                    {"描述你想生成的图片"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {"尽量写清主体、场景、风格和镜头感"}
                  </p>
                </div>
                <span className="text-xs text-zinc-400">
                  {prompt.length}/4000
                </span>
              </div>
              <Textarea
                value={prompt}
                onChange={(event) => onPromptChange(event.target.value)}
                placeholder="例如：高端咖啡品牌包装，暖调电影灯光，产品居中，桌面细节清晰，适合首页 banner"
                className="min-h-[150px] border-zinc-200 bg-zinc-50 text-zinc-950 placeholder:text-zinc-400"
                maxLength={4000}
              />
            </div>

            {/* 图片比例（嵌入在描述下方） */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-zinc-950">
                  {"图片比例"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {"根据内容场景选择输出画幅"}
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2.5">
                {SIZES.map((item) => {
                  const shape = RATIO_SHAPES[item.name] ?? { w: 22, h: 22 };
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSizeChange(item.id)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1.5 rounded-xl border py-3 transition-all",
                        size === item.id
                          ? "border-zinc-400 bg-zinc-100 text-zinc-950"
                          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                      )}
                    >
                      {/* 比例矩形图标 */}
                      <div
                        className={cn(
                          "rounded-[3px] border-[1.5px]",
                          size === item.id
                            ? "border-zinc-700"
                            : "border-zinc-400"
                        )}
                        style={{ width: shape.w, height: shape.h }}
                      />
                      <span className="text-xs font-semibold">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 高级设置弹窗 */}
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg px-1 py-1 text-zinc-500 transition hover:text-zinc-700"
                >
                  <Settings2 className="size-4" />
                  <span className="text-xs text-zinc-400">
                    {"高级设置：增强提示词 · 负向提示词 · 灵感模板"}
                  </span>
                </button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{"高级设置"}</DialogTitle>
                  <DialogDescription>
                    {"增强提示词、负向提示词和灵感模板"}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-2">
                  {/* 增强提示词 */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-zinc-950">
                      {"增强提示词"}
                    </p>
                    <div className="space-y-3">
                      {PROMPT_LIBRARY.map((group) => {
                        const GroupIcon =
                          PROMPT_GROUP_ICONS[group.key] ?? Sparkles;
                        return (
                          <div
                            key={group.title}
                            className="rounded-2xl bg-zinc-50 p-4"
                          >
                            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-950">
                              <GroupIcon className="size-4 text-zinc-700" />
                              {group.title}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {group.items.map((item) => (
                                <button
                                  key={item}
                                  type="button"
                                  onClick={() =>
                                    onTogglePromptOption(group.key, item)
                                  }
                                  className={cn(
                                    "rounded-full border px-3 py-1.5 text-xs transition",
                                    promptOptions[group.key].includes(item)
                                      ? "border-zinc-400 bg-zinc-200 text-zinc-900"
                                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100"
                                  )}
                                >
                                  {item}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 负向提示词 */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-zinc-950">
                      {"负向提示词"}
                    </p>
                    <Textarea
                      value={negativePrompt}
                      onChange={(event) =>
                        onNegativePromptChange(event.target.value)
                      }
                      placeholder="例如：模糊、低清晰度、杂乱背景、畸形手部、文字水印"
                      className="min-h-[80px] border-zinc-200 bg-zinc-50 text-zinc-950 placeholder:text-zinc-400"
                    />
                    <div className="flex flex-wrap gap-2">
                      {NEGATIVE_OPTIONS.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() =>
                            onTogglePromptOption("negatives", item, "negative")
                          }
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs transition",
                            promptOptions.negatives.includes(item)
                              ? "border-zinc-400 bg-zinc-200 text-zinc-900"
                              : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100"
                          )}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 灵感模板 */}
                  <div className="grid gap-2">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">
                      {"灵感模板"}
                    </p>
                    <div className="space-y-2">
                      {PROMPT_TEMPLATES.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => onApplyTemplate(item)}
                          className="w-full rounded-xl bg-zinc-50 px-3 py-2.5 text-left text-xs leading-5 text-zinc-600 transition hover:bg-zinc-100"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </section>
        </div>
      </div>

      <div className="p-5 pt-0 md:p-6 md:pt-0">
        <Button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating || !prompt.trim() || !canCreate}
          className="h-14 w-full rounded-2xl bg-zinc-950 text-base font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {isGenerating ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-5 animate-spin" />
              {"正在生成并上传素材..."}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Sparkles className="size-5" />
              {"开始创作"}
            </span>
          )}
        </Button>
      </div>
    </aside>
  );
}
