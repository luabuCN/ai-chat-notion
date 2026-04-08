import { Chat, useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExtensionModelInfo } from "@/hooks/use-extension-models";
import { createSidepanelChatTransport } from "@/lib/sidepanel-chat-transport";
import type { SidepanelSeedFromSelectionPayload } from "@/lib/sidepanel-seed-from-selection";
import { SIDEPANEL_SEED_FROM_SELECTION_KEY } from "@/lib/sidepanel-seed-from-selection";

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

  /** 为 true 时，下一次 POST 会附带 seedMessages，把划词首轮对话写入主站库 */
  const seedSyncPendingRef = useRef(false);

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
        () => seedSyncPendingRef.current,
      ),
    [],
  );

  const chat = useMemo(
    () =>
      new Chat<UIMessage>({
        id: chatId,
        onFinish: ({ isError }) => {
          if (!isError) {
            seedSyncPendingRef.current = false;
          }
        },
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
      seedSyncPendingRef.current = false;
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

  useEffect(() => {
    const applySeed = (payload: SidepanelSeedFromSelectionPayload) => {
      restoreChat(payload.chatId, payload.messages);
      seedSyncPendingRef.current = true;
    };

    const readInitial = async () => {
      try {
        const raw = await browser.storage.session.get(
          SIDEPANEL_SEED_FROM_SELECTION_KEY,
        );
        const v = raw[SIDEPANEL_SEED_FROM_SELECTION_KEY];
        if (
          v &&
          typeof v === "object" &&
          "chatId" in v &&
          "messages" in v &&
          typeof (v as SidepanelSeedFromSelectionPayload).chatId ===
            "string" &&
          Array.isArray((v as SidepanelSeedFromSelectionPayload).messages)
        ) {
          await browser.storage.session.remove(SIDEPANEL_SEED_FROM_SELECTION_KEY);
          applySeed(v as SidepanelSeedFromSelectionPayload);
        }
      } catch {
        // ignore
      }
    };
    void readInitial();

    const onStorageChanged: Parameters<
      typeof browser.storage.onChanged.addListener
    >[0] = (changes, areaName) => {
      if (areaName !== "session") {
        return;
      }
      const change = changes[SIDEPANEL_SEED_FROM_SELECTION_KEY];
      const nv = change?.newValue;
      if (
        nv &&
        typeof nv === "object" &&
        "chatId" in nv &&
        "messages" in nv &&
        typeof (nv as SidepanelSeedFromSelectionPayload).chatId === "string" &&
        Array.isArray((nv as SidepanelSeedFromSelectionPayload).messages)
      ) {
        void (async () => {
          try {
            await browser.storage.session.remove(
              SIDEPANEL_SEED_FROM_SELECTION_KEY,
            );
            applySeed(nv as SidepanelSeedFromSelectionPayload);
          } catch {
            // ignore
          }
        })();
      }
    };
    browser.storage.onChanged.addListener(onStorageChanged);
    return () => {
      browser.storage.onChanged.removeListener(onStorageChanged);
    };
  }, [restoreChat]);

  const resetToNewChat = useCallback(() => {
    seedSyncPendingRef.current = false;
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
