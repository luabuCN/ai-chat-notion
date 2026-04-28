import { ArrowDownToLine, Check, RefreshCcw, Trash2 } from "lucide-react";
import ActionItem from "./action-item";
import { useAIPanelStore } from "./ai-panel-store";

export default function ConfirmButtons() {
  return (
    <div id="ai-confirm-buttons" className="mt-1 inline-flex">
      <div className="rounded-xl border border-violet-200/70 bg-white/95 p-1 text-popover-foreground shadow-xl ring-1 ring-violet-100/80 backdrop-blur dark:border-violet-500/25 dark:bg-background/95 dark:ring-violet-500/15">
        <ReplaceButton />
        <InsertBelowButton />
        <DiscardButton />
        <TryAgainButton />
      </div>
    </div>
  );
}

function ReplaceButton() {
  const { replaceResult } = useAIPanelStore();
  const hasSelection = useAIPanelStore((state: any) => state.hasSelection);

  if (!hasSelection) return null;

  return (
    <ActionItem
      icon={<Check className="h-4 w-4" />}
      label="Replace"
      onClick={replaceResult}
    />
  );
}

function InsertBelowButton() {
  const { insertBelow } = useAIPanelStore();
  return (
    <ActionItem
      icon={<ArrowDownToLine className="h-4 w-4" />}
      label="Insert Below"
      onClick={insertBelow}
    />
  );
}

function DiscardButton() {
  const { discardResult } = useAIPanelStore();
  return (
    <ActionItem
      icon={<Trash2 className="h-4 w-4" />}
      label="Discard"
      onClick={discardResult}
    />
  );
}

function TryAgainButton() {
  const { retryStream } = useAIPanelStore();
  return (
    <ActionItem
      icon={<RefreshCcw className="h-4 w-4" />}
      label="Try again"
      onClick={retryStream}
    />
  );
}
