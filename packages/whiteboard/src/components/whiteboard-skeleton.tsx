import { cn } from "@repo/ui";

export function WhiteboardSkeleton({
  mode = "embed",
}: {
  mode?: "page" | "embed" | "fullscreen";
}) {
  return (
    <div
      className={cn(
        "animate-pulse bg-muted/40",
        mode === "page" ? "h-full min-h-[480px]" : "h-full min-h-[240px]"
      )}
    />
  );
}
