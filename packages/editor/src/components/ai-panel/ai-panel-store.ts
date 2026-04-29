import { create } from "zustand";
import { Editor } from "@tiptap/core";
import {
  PresetType,
  getStreamOptions,
  buildUserPromptMessage,
  buildContinueWritingPromptMessage,
  buildPresetPromptMessage,
  getEditorSelectedContent,
} from "./util";
import { AIStreamRequest } from "./types";
import scrollIntoView from "scroll-into-view-if-needed";

const AI_COMPLETION_ENDPOINT = "/api/ai/openai";

const buildAICompletionPayload = (request: AIStreamRequest) => {
  const options = request.options as
    | { temperature?: unknown; model?: unknown }
    | undefined;
  const model =
    typeof request.modelId === "string" && request.modelId.length > 0
      ? request.modelId
      : typeof options?.model === "string"
        ? options.model
        : undefined;

  return {
    messages: request.messages,
    stream: true,
    ...(typeof options?.temperature === "number"
      ? { temperature: options.temperature }
      : {}),
    ...(model ? { model } : {}),
  };
};

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

const buildInlinePreviewContent = (text: string) => {
  const lines = text.split("\n");
  return lines.flatMap((line, index) => {
    const content: Array<{ type: string; text?: string }> = line
      ? [{ type: "text", text: line }]
      : [];
    if (index < lines.length - 1) {
      content.push({ type: "hardBreak" });
    }
    return content;
  });
};

const buildPlainTextBlockContent = (text: string) => ({
  type: "paragraph",
  content: buildInlinePreviewContent(text),
});

const parseMarkdownContent = (editor: Editor, markdown: string) => {
  const manager = (editor as any).storage.markdown?.manager;
  if (!manager) {
    return markdown;
  }

  const processedMarkdown = markdown.replace(/^(#{1,6})([^\s#])/gm, "$1 $2");
  const json = manager.parse(processedMarkdown);
  return cleanMarks(json.type === "doc" ? json.content : json);
};

const getCurrentBlockRange = (editor: Editor) => {
  const { selection } = editor.state;
  const depth = Math.min(1, selection.$from.depth);

  if (depth === 0) {
    return {
      from: selection.from,
      to: selection.to,
    };
  }

  return {
    from: selection.$from.before(depth),
    to: selection.$from.after(depth),
  };
};

const SCROLL_MARGIN = 96;
const INLINE_STREAM_RENDER_INTERVAL = 48;

type InlineStreamPlacement = "replaceCurrentBlock" | "appendAfterSelection";

interface InlineStreamOptions {
  placement?: InlineStreamPlacement;
}

function findNearestVerticalScrollParent(from: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = from;

  while (node) {
    if (node === document.documentElement || node === document.body) {
      break;
    }

    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;

    if (
      (overflowY === "auto" ||
        overflowY === "scroll" ||
        overflowY === "overlay") &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return node;
    }

    node = node.parentElement;
  }

  return null;
}

const scrollCaretIntoReadableView = (editor: Editor) => {
  const view = editor.view;
  const pos = editor.state.selection.anchor;
  let caretRect: { top: number; bottom: number };

  try {
    const coords = view.coordsAtPos(pos);
    caretRect = {
      top: coords.top,
      bottom: coords.bottom,
    };
  } catch {
    return;
  }

  const dom = view.dom as HTMLElement;
  let scrollParent = findNearestVerticalScrollParent(dom);

  while (scrollParent) {
    const parentRect = scrollParent.getBoundingClientRect();

    if (caretRect.bottom > parentRect.bottom - SCROLL_MARGIN) {
      scrollParent.scrollTop += caretRect.bottom - parentRect.bottom + SCROLL_MARGIN;
    } else if (caretRect.top < parentRect.top + SCROLL_MARGIN) {
      scrollParent.scrollTop += caretRect.top - parentRect.top - SCROLL_MARGIN;
    }

    scrollParent = findNearestVerticalScrollParent(scrollParent.parentElement);
  }

  const viewportBottom = window.innerHeight;

  if (caretRect.bottom > viewportBottom - SCROLL_MARGIN) {
    window.scrollBy({
      top: caretRect.bottom - viewportBottom + SCROLL_MARGIN,
      left: 0,
      behavior: "auto",
    });
  }

  scrollIntoView(dom, {
    scrollMode: "if-needed",
    block: "nearest",
    behavior: "auto",
    skipOverflowHiddenElements: true,
  });
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
  startInlineStream: (
    request: AIStreamRequest,
    options?: InlineStreamOptions
  ) => Promise<void>;
  stopStream: () => void;
  retryStream: () => void;
  insertBelow: () => void;
  submitUserPrompt: () => Promise<void>;
  submitPresetPrompt: (preset: PresetType, options?: any) => Promise<void>;
  submitInlineContinueWriting: () => Promise<void>;
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
      const response = await fetch(AI_COMPLETION_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildAICompletionPayload(request)),
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

  // Stream directly into the document for insertion-style AI writing.
  startInlineStream: async (
    request: AIStreamRequest,
    options?: InlineStreamOptions
  ) => {
    get().stopStream();

    const { editor } = get();
    if (!editor) return;

    const wasEditable = editor.isEditable;
    editor.setEditable(false);

    const controller = new AbortController();
    const insertRange = getCurrentBlockRange(editor);
    let insertFrom = insertRange.from;
    let insertTo = insertRange.to;

    if (options?.placement === "appendAfterSelection") {
      const { selection } = editor.state;
      const depth = Math.min(1, selection.$to.depth);
      const insertAt = depth === 0 ? selection.to : selection.$to.after(depth);
      const previousDocSize = editor.state.doc.content.size;

      editor
        .chain()
        .focus()
        .insertContentAt(insertAt, { type: "paragraph" })
        .run();

      const insertedSize = editor.state.doc.content.size - previousDocSize;
      insertFrom = insertAt;
      insertTo = insertAt + Math.max(insertedSize, 0);
    }

    let streamedMarkdown = "";
    let hasRenderedContent = false;
    let hasRenderedFormattedContent = false;
    let lastRenderAt = 0;

    const renderInlineContent = (force = false) => {
      if (!streamedMarkdown) return;

      const now = Date.now();
      if (!force && now - lastRenderAt < INLINE_STREAM_RENDER_INTERVAL) {
        return;
      }

      let contentToInsert: any;
      let isFormattedContent = false;

      try {
        contentToInsert = parseMarkdownContent(editor, streamedMarkdown);
        isFormattedContent = true;
      } catch {
        if (hasRenderedFormattedContent) {
          lastRenderAt = now;
          return;
        }
        contentToInsert = buildPlainTextBlockContent(streamedMarkdown);
      }

      const previousDocSize = editor.state.doc.content.size;

      try {
        editor
          .chain()
          .focus()
          .insertContentAt(
            { from: insertFrom, to: insertTo },
            contentToInsert,
            { updateSelection: true }
          )
          .run();
      } catch {
        if (hasRenderedContent) {
          lastRenderAt = now;
          return;
        }

        editor
          .chain()
          .focus()
          .insertContentAt(
            { from: insertFrom, to: insertTo },
            buildPlainTextBlockContent(streamedMarkdown),
            { updateSelection: true }
          )
          .run();
        isFormattedContent = false;
      }

      const nextDocSize = editor.state.doc.content.size;
      insertTo += nextDocSize - previousDocSize;
      hasRenderedContent = true;
      hasRenderedFormattedContent =
        hasRenderedFormattedContent || isFormattedContent;
      lastRenderAt = now;
      scrollCaretIntoReadableView(editor);
    };

    set({
      currentRequest: request,
      isVisible: true,
      isInputFocused: false,
      isThinking: true,
      isStreaming: false,
      error: null,
      result: "",
      abortController: controller,
      wasEditable,
    });

    try {
      const response = await fetch(AI_COMPLETION_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildAICompletionPayload(request)),
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
        if (chunk) {
          streamedMarkdown += chunk;
          renderInlineContent();
        }
      }

      renderInlineContent(true);

      set({
        isVisible: false,
        isStreaming: false,
        isThinking: false,
        result: "",
        hasSelection: false,
        prompt: "",
      });
    } catch (error: any) {
      if (error.name === "AbortError") {
        return;
      }

      set({
        isVisible: true,
        error: {
          message: error.message,
          action: {
            label: "Retry",
            handler: () => get().startInlineStream(request),
          },
        },
        isStreaming: false,
        isThinking: false,
      });
    } finally {
      if (wasEditable) {
        editor.setEditable(true);
      }
      set({ abortController: null });
    }
  },

  // Submit user prompt
  submitUserPrompt: async () => {
    const { mode, prompt, editor, startStream, startInlineStream } = get();
    if (!prompt.trim() || !editor) return;

    const request: AIStreamRequest = {
      messages: buildUserPromptMessage(editor, prompt),
      options: getStreamOptions(),
    };

    if (mode === "command" && !getEditorSelectedContent(editor)) {
      await startInlineStream(request);
      return;
    }

    set({ prompt: "" });
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

  submitInlineContinueWriting: async () => {
    const { editor, startInlineStream } = get();
    if (!editor) return;

    const request: AIStreamRequest = {
      messages: buildContinueWritingPromptMessage(editor),
      options: getStreamOptions("continue_writing"),
    };

    set({ mode: "bubble" as AITriggerMode });
    await startInlineStream(request, { placement: "appendAfterSelection" });
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
