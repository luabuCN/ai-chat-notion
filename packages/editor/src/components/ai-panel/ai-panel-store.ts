import { create } from "zustand";
import { Editor } from "@tiptap/core";
import {
  PresetType,
  getStreamOptions,
  buildUserPromptMessage,
  buildPresetPromptMessage,
} from "./util";
import { AIStreamRequest } from "./types";
import scrollIntoView from "scroll-into-view-if-needed";

// 递归清理无效 mark 组合（code 不能与 bold/italic 等共存）
const cleanMarks = (node: any): any => {
  if (!node) return node;

  if (Array.isArray(node)) {
    return node.map(cleanMarks);
  }

  if (typeof node === "object") {
    const cleaned = { ...node };

    if (cleaned.marks && Array.isArray(cleaned.marks)) {
      const hasCode = cleaned.marks.some((m: any) => m.type === "code");
      if (hasCode) {
        cleaned.marks = cleaned.marks.filter(
          (m: any) => m.type === "code" || m.type === "link"
        );
      }
    }

    if (cleaned.content) {
      cleaned.content = cleanMarks(cleaned.content);
    }

    return cleaned;
  }

  return node;
};

// 触发来源模式
export type AITriggerMode = "command" | "bubble";

interface AIPanelState {
  // Services
  abortController: AbortController | null;

  // View States
  hasSelection: boolean;
  isVisible: boolean;
  isInputFocused: boolean;
  mode: AITriggerMode; // 触发来源

  // Input States
  prompt: string;

  // Processing States
  isThinking: boolean;
  isStreaming: boolean;

  // Result States
  result: string;
  error: {
    message: string;
    action: {
      label: string;
      handler: () => void;
    };
  } | null;

  // Editor Reference
  editor: Editor | null;
  currentRequest: AIStreamRequest | null;
  wasEditable: boolean; // 记录原始可编辑状态

  // Basic Actions
  setVisible: (visible: boolean) => void;
  setHasSelection: (hasSelection: boolean) => void;
  setInputFocused: (focused: boolean) => void;
  setPrompt: (prompt: string) => void;
  setMode: (mode: AITriggerMode) => void;
  setEditor: (editor: Editor) => void;

  // Complex Actions
  handleError: (message: string) => void;
  reset: () => void;
  replaceResult: () => void;
  discardResult: () => void;
  startStream: (request: AIStreamRequest) => Promise<void>;
  stopStream: () => void;
  retryStream: () => void;
  insertBelow: () => void;
  submitUserPrompt: () => Promise<void>;
  submitPresetPrompt: (preset: PresetType, options?: any) => Promise<void>;
}

export const store = create<AIPanelState>()((set, get) => ({
  // Initial States
  abortController: null,

  // Initial States
  isVisible: false,
  hasSelection: false,
  isInputFocused: false,
  mode: "command" as AITriggerMode,
  prompt: "",
  isThinking: false,
  isStreaming: false,
  result: "",
  error: null,
  editor: null,
  currentRequest: null,
  wasEditable: true,

  // Basic State Actions
  setVisible: (visible: boolean) => set({ isVisible: visible }),
  setHasSelection: (hasSelection: boolean) => set({ hasSelection }),
  setInputFocused: (focused: boolean) => set({ isInputFocused: focused }),
  setPrompt: (prompt: string) => set({ prompt }),
  setEditor: (editor: Editor) => set({ editor }),
  setMode: (mode: AITriggerMode) => set({ mode }),

  // Error Handler
  handleError: (message: string) => {
    set({
      isThinking: false,
      error: {
        message,
        action: {
          label: "Retry",
          handler: () => get().retryStream(),
        },
      },
    });
  },

  // Reset all states
  reset: () => {
    const { editor, wasEditable } = get();
    // 恢复编辑器可编辑状态
    if (editor && wasEditable) {
      editor.setEditable(true);
    }
    set({
      hasSelection: false,
      isVisible: false,
      isInputFocused: false,
      isThinking: false,
      isStreaming: false,
      result: "",
      error: null,
      prompt: "",
      mode: "command" as AITriggerMode,
      wasEditable: true,
    });
  },

  // Handle result confirmation - replaces selection with AI result
  replaceResult: () => {
    const { editor, result, hasSelection } = get();
    if (!editor || !result) return;

    // Fix possible missing spaces in headings
    const processedResult = result.replace(/^(#{1,6})([^\s#])/gm, "$1 $2");

    // Use markdown manager to parse if available
    const manager = (editor as any).storage.markdown?.manager;
    if (manager) {
      try {
        const json = manager.parse(processedResult);
        // If it's a full doc, use its content array
        let contentToInsert = json.type === "doc" ? json.content : json;
        // 清理无效 mark 组合
        contentToInsert = cleanMarks(contentToInsert);
        if (contentToInsert) {
          // 如果有选中内容，先删除再插入
          if (hasSelection) {
            editor
              .chain()
              .focus()
              .deleteSelection()
              .insertContent(contentToInsert)
              .run();
          } else {
            editor.chain().focus().insertContent(contentToInsert).run();
          }
          get().reset();
          return;
        }
      } catch (e) {
        console.error("Failed to parse AI markdown result:", e);
      }
    }

    // Fallback: Use standard insertContent command
    if (hasSelection) {
      editor
        .chain()
        .focus()
        .deleteSelection()
        .insertContent(processedResult)
        .run();
    } else {
      editor.chain().focus().insertContent(processedResult).run();
    }
    get().reset();
  },

  // Insert content below - inserts after current selection/position
  insertBelow: () => {
    const { editor, result, hasSelection } = get();
    if (!editor || !result) return;

    // Fix possible missing spaces in headings
    const processedResult = result.replace(/^(#{1,6})([^\s#])/gm, "$1 $2");

    // 先移动到选中内容的末尾
    const { selection } = editor.state;
    const endPos = selection.to;

    // 移动光标到选中内容末尾，然后插入新段落
    const contentToInsert = "\n" + processedResult;

    // Use markdown manager to parse if available
    const manager = (editor as any).storage.markdown?.manager;
    if (manager) {
      try {
        const json = manager.parse(contentToInsert);
        let parsedContent = json.type === "doc" ? json.content : json;
        // 清理无效 mark 组合
        parsedContent = cleanMarks(parsedContent);
        if (parsedContent) {
          editor
            .chain()
            .focus()
            .setTextSelection(endPos)
            .insertContent(parsedContent)
            .run();
          get().reset();
          return;
        }
      } catch (e) {
        console.error("Failed to parse AI markdown result (insert below):", e);
      }
    }

    editor
      .chain()
      .focus()
      .setTextSelection(endPos)
      .insertContent(contentToInsert)
      .run();
    get().reset();
  },

  // Handle result cancellation
  discardResult: () => {
    get().reset();
    get().editor?.commands.focus();
  },

  // Start streaming process
  startStream: async (request: AIStreamRequest) => {
    // Abort any existing stream
    get().stopStream();

    const { editor } = get();
    // 保存编辑器原始状态并锁定
    const wasEditable = editor?.isEditable ?? true;
    if (editor) {
      editor.setEditable(false);
    }

    const controller = new AbortController();
    set({
      currentRequest: request,
      isThinking: true,
      isStreaming: false,
      error: null,
      result: "",
      abortController: controller,
      wasEditable,
    });

    try {
      const response = await fetch("/api/ai/completion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body is null");
      }

      const decoder = new TextDecoder();
      set({ isThinking: false, isStreaming: true });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        set((state) => ({ result: state.result + chunk }));
      }

      set({ isStreaming: false, isThinking: false });

      // Scroll to confirm buttons after stream is complete
      setTimeout(() => {
        const confirmButtons = document.getElementById("ai-confirm-buttons");
        if (confirmButtons) {
          scrollIntoView(confirmButtons, {
            scrollMode: "if-needed",
            block: "nearest",
            behavior: "smooth",
          });
        }
      }, 50);
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("Stream aborted");
        return;
      }

      set({
        error: {
          message: error.message,
          action: {
            label: "Retry",
            handler: () => get().retryStream(),
          },
        },
        isStreaming: false,
        isThinking: false,
      });
    } finally {
      set({ abortController: null });
    }
  },

  // Submit user prompt
  submitUserPrompt: async () => {
    const { prompt, editor, startStream } = get();
    if (!prompt.trim() || !editor) return;

    set({ prompt: "" });

    const request: AIStreamRequest = {
      messages: buildUserPromptMessage(editor, prompt),
      options: getStreamOptions(),
    };

    await startStream(request);
  },

  // Submit preset action
  submitPresetPrompt: async (preset: PresetType, options?: any) => {
    const { editor, startStream } = get();
    if (!editor) return;

    const request: AIStreamRequest = {
      messages: buildPresetPromptMessage(editor, preset, options),
      options: getStreamOptions(preset),
    };

    await startStream(request);
  },

  // Retry stream
  retryStream: () => {
    const currentRequest = get().currentRequest;
    if (!currentRequest) return;
    get().startStream(currentRequest);
  },

  // Stop stream
  stopStream: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
    set({ isStreaming: false, isThinking: false, abortController: null });
  },
}));

export const useAIPanelStore = store;
