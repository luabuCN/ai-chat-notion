import { Chat, useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExtensionModelInfo } from "@/hooks/use-extension-models";
import { createSidepanelChatTransport } from "@/lib/sidepanel-chat-transport";

export function useSidepanelChat(
  models: ExtensionModelInfo[],
  modelsLoading: boolean,
  workspaceSlug: string,
) {
  const [chatId, setChatId] = useState<string>(() => crypto.randomUUID());
  const pendingRestoreRef = useRef<{
    chatId: string;
    messages: UIMessage[];
  } | null>(null);

  const [selectedModelId, setSelectedModelId] = useState("");
  const [enableReasoning, setEnableReasoning] = useState(false);
  const [input, setInput] = useState("");

  const currentModelIdRef = useRef(selectedModelId);
  currentModelIdRef.current = selectedModelId;

  const workspaceSlugRef = useRef(workspaceSlug);
  workspaceSlugRef.current = workspaceSlug;

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
    () =>
      createSidepanelChatTransport(
        () => currentModelIdRef.current,
        () => workspaceSlugRef.current,
      ),
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
    setMessages,
    sendMessage,
    status,
    stop,
    error,
    clearError,
  } = useChat<UIMessage>({
    chat,
    experimental_throttle: 100,
  });

  useEffect(() => {
    const pending = pendingRestoreRef.current;
    if (!pending || pending.chatId !== chatId) {
      return;
    }
    setMessages(pending.messages);
    pendingRestoreRef.current = null;
  }, [chatId, setMessages]);

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
    if (
      !text ||
      busy ||
      modelsLoading ||
      !selectedModel ||
      !workspaceSlug.trim()
    ) {
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
    workspaceSlug,
  ]);

  const restoreChat = useCallback(
    (nextChatId: string, nextMessages: UIMessage[]) => {
      if (nextChatId === chatId) {
        setMessages(nextMessages);
        return;
      }
      pendingRestoreRef.current = {
        chatId: nextChatId,
        messages: nextMessages,
      };
      setChatId(nextChatId);
    },
    [chatId, setMessages],
  );

  const resetToNewChat = useCallback(() => {
    const newChatId = crypto.randomUUID();
    pendingRestoreRef.current = {
      chatId: newChatId,
      messages: [],
    };
    setChatId(newChatId);
    setInput("");
  }, []);

  return {
    chatId,
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
    restoreChat,
    resetToNewChat,
  };
}
