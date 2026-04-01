import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import { Cpu } from "lucide-react";
import type { ExtensionModelInfo } from "@/hooks/use-extension-models";

export function ModelSelectorBar({
  selectedModelId,
  onModelChange,
  models,
  modelsLoading,
}: {
  selectedModelId: string;
  onModelChange: (id: string) => void;
  models: ExtensionModelInfo[];
  modelsLoading: boolean;
}) {
  const selected =
    models.find((m) => m.full_slug === selectedModelId) ?? models[0];

  return (
    <Select
      disabled={modelsLoading || models.length === 0}
      onValueChange={onModelChange}
      value={selected?.full_slug}
    >
      <SelectTrigger
        className="h-8 max-w-44 border-none bg-transparent px-2 font-medium text-muted-foreground text-xs shadow-none hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
        title={selected?.model}
      >
        <Cpu className="size-4 shrink-0" />
        <SelectValue placeholder={modelsLoading ? "加载模型…" : "选择模型"} />
      </SelectTrigger>
      <SelectContent className="max-h-[min(60vh,320px)]">
        {[...models]
          .sort((a, b) => a.model.localeCompare(b.model))
          .map((model) => (
            <SelectItem key={model.full_slug} value={model.full_slug}>
              <span className="font-medium text-xs">{model.model}</span>
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}
