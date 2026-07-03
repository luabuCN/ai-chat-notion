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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useSidebar,
} from "@repo/ui";
import { SidebarToggle } from "@/components/sidebar-toggle";
import {
  Camera,
  Loader2,
  Sparkles,
  Sun,
  Eraser,
  Wand2,
  Palette,
  Image as ImageIcon,
  Settings2,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOptimizePrompt } from "./actions";
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
  scenes: ImageIcon,
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
  pendingCount?: number;
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
  onReset: () => void;
};

export function StudioSidebar({
  currentWorkspaceName,
  model,
  prompt,
  negativePrompt,
  size,
  promptOptions,
  isGenerating,
  pendingCount = 0,
  canCreate,
  onModelChange,
  onPromptChange,
  onNegativePromptChange,
  onSizeChange,
  onTogglePromptOption,
  onApplyTemplate,
  onGenerate,
  onReset,
}: StudioSidebarProps) {
  const { mutate: optimizePrompt, isPending: isOptimizing } =
    useOptimizePrompt();
  const { open } = useSidebar();

  return (
    <aside className="flex h-full w-full flex-col border-b border-zinc-100 bg-white xl:w-[380px] xl:border-b-0 xl:border-r">
      {/* 顶部 header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          {!open && (
            <SidebarToggle variant="ghost" className="h-7 w-7 shrink-0 text-zinc-400 hover:text-zinc-700" />
          )}
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
            <Sparkles className="size-3.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900">{"AI 创作工坊"}</p>
            <p className="text-xs text-zinc-400">
              {currentWorkspaceName
                ? `当前空间：${currentWorkspaceName}`
                : "为当前空间生成可追踪的视觉素材"}
            </p>
          </div>
        </div>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onReset}
              className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-blue-50 hover:text-primary"
            >
              <Eraser className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{"清空所有设置和提示词"}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* 主内容区 - 可滚动 */}
      <div className="min-h-0 flex-1 ">
        <div className="space-y-6 px-5 pb-4">

          {/* AI 模型 */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-800">{"AI 模型"}</p>
            <p className="text-xs text-zinc-400">{"选择适合当前视觉风格的出图引擎"}</p>
            <Select value={model} onValueChange={onModelChange}>
              <SelectTrigger className="w-full border-zinc-200 bg-zinc-50 text-sm hover:bg-zinc-100">
                <SelectValue placeholder="选择模型" />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    <div className="flex items-center gap-2">
                      <span>{item.name}</span>
                      <Badge className="border-0 bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500">
                        {item.badge}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 描述输入 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-800">{"描述你想生成的图片"}</p>
              <span className="text-xs text-zinc-400">{prompt.length}/4000</span>
            </div>
            <div className="relative rounded-xl border border-zinc-200 bg-zinc-50 transition-colors focus-within:border-primary/40 focus-within:bg-white focus-within:ring-1 focus-within:ring-primary/20">
              <textarea
                value={prompt}
                onChange={(event) => onPromptChange(event.target.value)}
                placeholder="例如：高端咖啡品牌包装，暖调电影灯光，桌面细节清晰..."
                className="min-h-[130px] w-full resize-none bg-transparent px-3 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:outline-none focus:ring-0"
                style={{ boxShadow: "none" }}
                maxLength={4000}
              />
              <div className="flex justify-end px-2 pb-2">
                <button
                  type="button"
                  onClick={() => {
                    if (prompt.trim()) {
                      optimizePrompt({ prompt, onUpdate: onPromptChange });
                    }
                  }}
                  disabled={isOptimizing || !prompt.trim()}
                  className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-blue-50 hover:text-primary disabled:pointer-events-none disabled:opacity-40"
                >
                  {isOptimizing ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Wand2 className="size-3" />
                  )}
                  {"优化描述"}
                </button>
              </div>
            </div>
          </div>

          {/* 图片比例 */}
          <div className="space-y-2.5">
            <div>
              <p className="text-sm font-medium text-zinc-800">{"图片比例"}</p>
              <p className="mt-0.5 text-xs text-zinc-400">{"根据内容场景选择输出画幅"}</p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {SIZES.map((item) => {
                const shape = RATIO_SHAPES[item.name] ?? { w: 22, h: 22 };
                const isSelected = size === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSizeChange(item.id)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 rounded-xl py-3 transition-all",
                      isSelected
                        ? "bg-blue-50 text-primary"
                        : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
                    )}
                  >
                    {/* 比例矩形图标 */}
                    <div
                      className={cn(
                        "rounded-[3px] border-[1.5px]",
                        isSelected ? "border-primary" : "border-zinc-400"
                      )}
                      style={{ width: shape.w, height: shape.h }}
                    />
                    <span className="text-[11px] font-medium">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 灵感模板 */}
          <div className="space-y-2.5">
            <div>
              <p className="text-sm font-medium text-zinc-800">{"灵感模板"}</p>
              <p className="mt-0.5 text-xs text-zinc-400">{"点击后填充可填充词语"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {PROMPT_TEMPLATES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onApplyTemplate(item)}
                  className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600 text-left transition hover:bg-blue-50 hover:text-primary"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* 高级设置 */}
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs text-zinc-400 transition hover:text-primary"
              >
                <Settings2 className="size-3.5" />
                {"高级设置"}
                <ChevronDown className="size-3" />
              </button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{"高级设置"}</DialogTitle>
                <DialogDescription>
                  {"增强提示词与负向提示词"}
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
                                    ? "border-primary/30 bg-blue-50 text-primary"
                                    : "border-zinc-200 bg-white text-zinc-700 hover:border-primary/20 hover:bg-blue-50 hover:text-primary"
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
                            ? "border-primary/30 bg-blue-50 text-primary"
                            : "border-zinc-200 bg-white text-zinc-700 hover:border-primary/20 hover:bg-blue-50 hover:text-primary"
                        )}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

        </div>
      </div>

      {/* 底部生成按钮 */}
      <div className="px-5 py-4">
        {pendingCount > 0 ? (
          <p className="mb-2 text-center text-xs text-zinc-500">
            {pendingCount} 个任务在后台生成中，可继续提交新任务
          </p>
        ) : null}
        <Button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating || !prompt.trim() || !canCreate}
          className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          {isGenerating ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              {"正在提交任务..."}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Sparkles className="size-4" />
              {"开始创作"}
            </span>
          )}
        </Button>
      </div>
    </aside>
  );
}
