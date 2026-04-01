import { Button, Textarea } from "@repo/ui";
import { ArrowUp, Loader2, Square } from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";
import { ExtensionMessageList } from "@/components/sidepanel/extension-message-list";
import { SidePanelEmptyState } from "@/components/sidepanel/SidePanelEmptyState";
import { ModelSelectorBar } from "@/components/sidepanel/model-selector-bar";
import { ReasoningToggleBar } from "@/components/sidepanel/reasoning-toggle-bar";
import type { MainSiteAuthState } from "@/hooks/use-main-site-auth";
import { useExtensionModels } from "@/hooks/use-extension-models";
import { useSidepanelChat } from "@/hooks/use-sidepanel-chat";

export function SidePanelChat({ auth }: { auth: MainSiteAuthState }) {
  const { models, loading: modelsLoading, error: modelsError } =
    useExtensionModels();

  const {
    messages,
    status,
    stop,
    error,
    input,
    setInput,
    handleSend,
    busy,
    selectedModelId,
    setSelectedModelId,
    enableReasoning,
    setEnableReasoning,
    supportsReasoning,
    selectedModel,
  } = useSidepanelChat(models, modelsLoading);

  const onFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSend();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) {
      return;
    }
    e.preventDefault();
    handleSend();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {messages.length === 0 ? (
        <SidePanelEmptyState auth={auth} />
      ) : (
        <ExtensionMessageList messages={messages} />
      )}

      {modelsError ? (
        <p className="shrink-0 px-2 pb-1 text-destructive text-xs">
          模型列表加载失败：{modelsError}
        </p>
      ) : null}
      {error ? (
        <p className="shrink-0 px-2 pb-1 text-destructive text-xs">
          {error.message}
        </p>
      ) : null}

      <form
        className="shrink-0 border-border border-t bg-background p-2"
        onSubmit={onFormSubmit}
      >
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-background p-2 shadow-xs">
          <Textarea
            className="min-h-[72px] resize-none rounded-xl border-none bg-transparent p-2 text-sm shadow-none focus-visible:ring-0"
            name="message"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="发送消息…"
            value={input}
          />
          <div className="flex items-center justify-between gap-1 pt-1">
            <div className="flex min-w-0 flex-1 items-center gap-0.5">
              <ModelSelectorBar
                models={models}
                modelsLoading={modelsLoading}
                onModelChange={setSelectedModelId}
                selectedModelId={selectedModelId}
              />
              <ReasoningToggleBar
                disabled={busy}
                enabled={enableReasoning}
                onToggle={setEnableReasoning}
                supportsReasoning={supportsReasoning}
              />
            </div>
            {busy ? (
              <Button
                aria-label={status === "submitted" ? "等待响应" : "停止生成"}
                className="size-9 shrink-0 rounded-full"
                onClick={() => void stop()}
                type="button"
                variant="default"
              >
                {status === "submitted" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Square className="size-4" />
                )}
              </Button>
            ) : (
              <Button
                aria-label="发送"
                className="size-9 shrink-0 rounded-full"
                disabled={!input.trim() || modelsLoading || !selectedModel}
                type="submit"
              >
                <ArrowUp className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
