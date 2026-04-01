import { Button, cn } from "@repo/ui";
import { Brain } from "lucide-react";

export function ReasoningToggleBar({
  enabled,
  onToggle,
  supportsReasoning,
  disabled,
}: {
  enabled: boolean;
  onToggle: (next: boolean) => void;
  supportsReasoning: boolean;
  disabled: boolean;
}) {
  const isDisabled = disabled || !supportsReasoning;
  return (
    <Button
      aria-label={
        supportsReasoning
          ? enabled
            ? "深度思考已启用"
            : "启用深度思考"
          : "当前模型不支持深度思考"
      }
      aria-pressed={enabled}
      className={cn(
        "h-8 shrink-0 gap-1 rounded-lg px-2 font-normal text-xs",
        enabled && supportsReasoning
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground",
      )}
      disabled={isDisabled}
      onClick={(e) => {
        e.preventDefault();
        if (!isDisabled) {
          onToggle(!enabled);
        }
      }}
      title={
        supportsReasoning
          ? enabled
            ? "深度思考已启用"
            : "启用深度思考"
          : "当前模型不支持深度思考"
      }
      type="button"
      variant="ghost"
    >
      <Brain className="size-4 shrink-0" />
      <span className="max-w-20 truncate sm:max-w-none">思考</span>
    </Button>
  );
}
