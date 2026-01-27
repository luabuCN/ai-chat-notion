"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type {
  AICompletionProvider,
  AIAutocompleteOptions,
  GhostTextPosition,
} from "../tiptap/extensions/ai-autocomplete/types";
import {
  registerAIAutocompleteHandlers,
  unregisterAIAutocompleteHandlers,
} from "../tiptap/extensions/ai-autocomplete";

interface UseAIAutocompleteProps {
  editor: Editor | null;
  completionProvider: AICompletionProvider;
  options?: AIAutocompleteOptions;
}

export function useAIAutocomplete({
  editor,
  completionProvider,
  options = {},
}: UseAIAutocompleteProps) {
  const [pendingCompletion, setPendingCompletion] = useState("");
  const [ghostPosition, setGhostPosition] = useState<GhostTextPosition | null>(
    null
  );
  const pendingCompletionRef = useRef("");
  const editorIdRef = useRef<string | null>(null);
  const wasAcceptedRef = useRef(false);
  // 保存触发补全时的光标位置
  const triggerPositionRef = useRef<number | null>(null);

  const config = useMemo(() => {
    const defaultOptions: Required<AIAutocompleteOptions> = {
      enabled: true,
      acceptKeys: ["Tab", "Enter", "ArrowRight"],
      dismissKey: "Escape",
      requestKey: "Tab",
      maxTokens: 60,
      temperature: 0.5,
      stopSequences: ["\n\n"],
      promptTemplate: (text: string) =>
        text.trim().length > 0
          ? `Continue the text with the next sentence only. Keep it concise and do not repeat existing text. Provide only the continuation without quotes.\n\nContext:\n${text}\n\nContinuation:`
          : "Write a short first sentence to start a document.",
      postProcess: (completion: string) => {
        const trimmed = completion.replace(/\s+/g, " ").trim();
        if (!trimmed) return "";
        const match = trimmed.match(/(.+?[\.!\?])( |$)/);
        if (match) return match[1] + " ";
        return trimmed.slice(0, 120);
      },
      model: "openrouter/auto",
    };
    return { ...defaultOptions, ...options };
  }, [options]);

  // 当 AI 补全改变时更新待处理补全
  useEffect(() => {
    if (completionProvider.completion && !completionProvider.isLoading) {
      // 如果建议已被手动接受/取消，不更新
      if (wasAcceptedRef.current) {
        console.log(
          "🚫 Ignoring completion update - suggestion was accepted/dismissed"
        );
        return;
      }

      const processed = config.postProcess(completionProvider.completion);
      console.log("📝 Updating pending completion from provider:", processed);
      setPendingCompletion(processed);
      pendingCompletionRef.current = processed;
    }
  }, [completionProvider.completion, completionProvider.isLoading, config]);

  // 计算 ghost 文本位置（使用触发位置而非当前光标位置）
  const updateGhostPosition = useCallback(() => {
    if (!editor || !pendingCompletion || triggerPositionRef.current === null) {
      setGhostPosition(null);
      return;
    }

    try {
      // 使用触发补全时保存的位置，而不是当前光标位置
      const pos = triggerPositionRef.current;
      const coords = editor.view.coordsAtPos(pos);
      const editorContainer = editor.view.dom.closest(".ProseMirror");

      if (!editorContainer) return;

      const relativeContainer =
        (editorContainer as HTMLElement).offsetParent || editorContainer;
      const parentRect = relativeContainer.getBoundingClientRect();

      const position = {
        top: coords.top - parentRect.top,
        left: coords.left - parentRect.left,
      };

      setGhostPosition(position);
    } catch (error) {
      console.error("Error calculating ghost position:", error);
      setGhostPosition({ top: 40, left: 20 });
    }
  }, [editor, pendingCompletion]);

  // 接受建议
  const acceptSuggestion = useCallback(() => {
    const currentCompletion = pendingCompletionRef.current;

    if (!editor || !currentCompletion.trim()) return false;

    try {
      console.log("🎯 Accepting suggestion:", currentCompletion);

      // 先标记为已接受，防止竞态条件
      wasAcceptedRef.current = true;

      // 立即清除建议状态
      console.log("🧹 Clearing pending completion state");
      setPendingCompletion("");
      pendingCompletionRef.current = "";
      triggerPositionRef.current = null;

      // 使用 setTimeout 避免键盘处理器中的事务冲突
      setTimeout(() => {
        try {
          if (editor && !editor.isDestroyed) {
            const success = editor.commands.insertContent(currentCompletion);
            if (!success) {
              console.warn("⚠️ InsertContent command returned false");
            }
          }
        } catch (insertError) {
          console.error("❌ Error in delayed insert:", insertError);
        }
      }, 0);

      return true;
    } catch (error) {
      console.error("❌ Error accepting suggestion:", error);
      return false;
    }
  }, [editor]);

  // 取消建议
  const dismissSuggestion = useCallback(() => {
    console.log("🗑️ Dismissing suggestion");

    // 标记为已取消，防止 useEffect 覆盖
    wasAcceptedRef.current = true;

    setPendingCompletion("");
    pendingCompletionRef.current = "";
    triggerPositionRef.current = null;
    return true;
  }, []);

  // 请求新建议
  const requestSuggestion = useCallback(async () => {
    if (completionProvider.isLoading || !editor || !config.enabled) {
      console.log("🚫 Request blocked:", {
        loading: completionProvider.isLoading,
        editor: !!editor,
        enabled: config.enabled,
      });
      return;
    }

    // 重置接受标志以便新请求
    wasAcceptedRef.current = false;

    // 保存触发位置（当前光标位置）
    const { from } = editor.state.selection;
    triggerPositionRef.current = from;

    const text = editor.getText();
    const prompt = config.promptTemplate(text);

    setPendingCompletion("");
    pendingCompletionRef.current = "";

    console.log(
      "🎯 Requesting suggestion with prompt:",
      prompt.substring(0, 100) + "..."
    );
    await completionProvider.complete(prompt, {
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      stop: config.stopSequences,
    });
  }, [editor, completionProvider, config]);

  // 检查当前是否有补全且功能启用
  const hasPendingCompletion = useCallback(() => {
    return config.enabled && pendingCompletionRef.current.trim().length > 0;
  }, [config.enabled]);

  // 注册处理器函数
  const registerHandlers = useCallback(
    (targetEditor: Editor) => {
      const extension = targetEditor.extensionManager.extensions.find(
        (ext) => ext.name === "aiAutocomplete"
      );

      console.log("🔍 Extension found:", !!extension);

      if (extension) {
        const editorStorage = targetEditor.storage.aiAutocomplete;
        console.log("🔍 Editor storage for aiAutocomplete:", editorStorage);

        let editorId = editorStorage?.editorId;

        // 如果存储中没有 ID，生成一个并设置
        if (!editorId) {
          editorId = Math.random().toString(36).substr(2, 9);
          if (editorStorage) {
            editorStorage.editorId = editorId;
          }
          console.log("🆔 Generated new editor ID:", editorId);
        }

        editorIdRef.current = editorId;

        // 向扩展注册处理器
        console.log(
          "🔧 Registering AI autocomplete handlers for editor:",
          editorId
        );
        registerAIAutocompleteHandlers(editorId, {
          acceptSuggestion,
          dismissSuggestion,
          requestSuggestion,
          hasPendingCompletion,
        });
        console.log("✅ Handlers registered successfully");

        // 设置编辑器事件监听器以更新 ghost 位置
        const handleUpdate = () => {
          setTimeout(updateGhostPosition, 0);
        };

        // 监听选区变化 - 当光标离开触发位置时取消建议
        const handleSelectionChange = () => {
          if (triggerPositionRef.current !== null && hasPendingCompletion()) {
            const { from } = targetEditor.state.selection;
            // 如果光标位置发生变化，取消建议
            if (from !== triggerPositionRef.current) {
              console.log(
                "🚫 Cursor moved away from trigger position, dismissing suggestion"
              );
              dismissSuggestion();
            }
          }
        };

        targetEditor.on("selectionUpdate", handleSelectionChange);
        targetEditor.on("update", handleUpdate);

        // 返回清理函数
        return () => {
          targetEditor.off("selectionUpdate", handleSelectionChange);
          targetEditor.off("update", handleUpdate);
          unregisterAIAutocompleteHandlers(editorId);
        };
      }

      return () => {};
    },
    [
      acceptSuggestion,
      dismissSuggestion,
      requestSuggestion,
      hasPendingCompletion,
      updateGhostPosition,
    ]
  );

  // 当编辑器改变时注册处理器
  useEffect(() => {
    if (!editor) return;
    return registerHandlers(editor);
  }, [editor, registerHandlers]);

  // 当相关状态改变时更新 ghost 位置
  useEffect(() => {
    updateGhostPosition();
  }, [pendingCompletion, updateGhostPosition]);

  return {
    pendingCompletion,
    ghostPosition,
    acceptSuggestion,
    dismissSuggestion,
    requestSuggestion,
    registerHandlers,
    isLoading: completionProvider.isLoading,
    config,
  };
}
