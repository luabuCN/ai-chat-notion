import { Chat, useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExtensionModelInfo } from "@/hooks/use-extension-models";
import { createSidepanelChatTransport } from "@/lib/sidepanel-chat-transport";

export function useSidepanelChat(
  models: ExtensionModelInfo[],
  modelsLoading: boolean,
) {
  const chatIdRef = useRef<string>("");
  if (chatIdRef.current === "") {
    chatIdRef.current = crypto.randomUUID();
  }
  const chatId = chatIdRef.current;

  const [selectedModelId, setSelectedModelId] = useState("");
  const [enableReasoning, setEnableReasoning] = useState(false);
  const [input, setInput] = useState("");

  const currentModelIdRef = useRef(selectedModelId);
  currentModelIdRef.current = selectedModelId;

  useEffect(() => {
    if (modelsLoading || models.length === 0) {
      return;
    }
    const valid = models.some((m) => m.full_slug === selectedModelId);
    if (!valid) {
      setSelectedModelId(models[0].full_slug);
    }
  }, [models, modelsLoading, selectedModelId]);

  const transport = useMemo(
    () => createSidepanelChatTransport(() => currentModelIdRef.current),
    [],
  );

  const chat = useMemo(
    () =>
      new Chat<UIMessage>({
        id: chatId,
        transport,
        generateId: () => crypto.randomUUID(),
      }),
    [chatId, transport],
  );

  const {
    messages,
    sendMessage,
    status,
    stop,
    error,
    clearError,
  } = useChat<UIMessage>({
    chat,
    experimental_throttle: 100,
  });

  const selectedModel = useMemo(
    () => models.find((m) => m.full_slug === selectedModelId),
    [models, selectedModelId],
  );
  const supportsReasoning = selectedModel?.supports_reasoning ?? false;

  useEffect(() => {
    if (!supportsReasoning && enableReasoning) {
      setEnableReasoning(false);
    }
  }, [supportsReasoning, enableReasoning]);

  const busy = status === "submitted" || status === "streaming";

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || busy || modelsLoading || !selectedModel) {
      return;
    }
    clearError();
    void sendMessage(
      { text },
      {
        body: {
          enableReasoning: enableReasoning && supportsReasoning,
          modelCapabilities: {
            supports_image_in: selectedModel.supports_image_in,
            supports_video_in: selectedModel.supports_video_in,
            supports_reasoning: selectedModel.supports_reasoning,
          },
          selectedModelSlug: selectedModel.full_slug,
        },
      },
    );
    setInput("");
  }, [
    input,
    busy,
    modelsLoading,
    selectedModel,
    clearError,
    sendMessage,
    enableReasoning,
    supportsReasoning,
  ]);

  return {
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
  };
}
