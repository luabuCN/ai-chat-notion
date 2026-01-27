import { Extension } from "@tiptap/core";
import { AIAutocompleteOptions } from "./types";

// 全局处理器存储 - 允许 React Hook 注册处理器
const globalHandlers = new Map<
  string,
  {
    acceptSuggestion: () => boolean;
    dismissSuggestion: () => boolean;
    requestSuggestion: () => void;
    hasPendingCompletion: () => boolean;
  }
>();

export interface AIAutocompleteStorage {
  editorId: string;
}

declare module "@tiptap/core" {
  interface Storage {
    aiAutocomplete: AIAutocompleteStorage;
  }
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    aiAutocomplete: {
      acceptSuggestion: () => ReturnType;
      dismissSuggestion: () => ReturnType;
      requestSuggestion: () => ReturnType;
    };
  }
}

export const AIAutocomplete = Extension.create<
  AIAutocompleteOptions,
  AIAutocompleteStorage
>({
  name: "aiAutocomplete",

  addOptions() {
    return {
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
  },

  addStorage() {
    return {
      editorId: "",
    };
  },

  onCreate() {
    // 创建时生成唯一的编辑器 ID
    this.storage.editorId = Math.random().toString(36).substr(2, 9);
    console.log(
      "🆔 AIAutocomplete extension created with ID:",
      this.storage.editorId
    );
  },

  addCommands() {
    return {
      acceptSuggestion:
        () =>
        ({ editor }) => {
          const editorId = editor.storage.aiAutocomplete?.editorId;
          const handlers = globalHandlers.get(editorId);
          if (handlers) {
            return handlers.acceptSuggestion();
          }
          return false;
        },

      dismissSuggestion:
        () =>
        ({ editor }) => {
          const editorId = editor.storage.aiAutocomplete?.editorId;
          const handlers = globalHandlers.get(editorId);
          if (handlers) {
            return handlers.dismissSuggestion();
          }
          return false;
        },

      requestSuggestion:
        () =>
        ({ editor }) => {
          const editorId = editor.storage.aiAutocomplete?.editorId;
          const handlers = globalHandlers.get(editorId);
          if (handlers) {
            handlers.requestSuggestion();
            return true;
          }
          return false;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        console.log("🔥 TAB KEY PRESSED in AI Autocomplete extension!");
        const editorId = editor.storage.aiAutocomplete?.editorId;
        console.log("🔍 Editor ID:", editorId);

        const handlers = globalHandlers.get(editorId);
        console.log("🔍 Handlers found:", handlers ? "✅ YES" : "❌ NO");
        if (!handlers) {
          console.log("❌ No handlers registered, ignoring Tab");
          return false;
        }

        const hasPendingCompletion = handlers.hasPendingCompletion();
        console.log("🔍 Has pending completion:", hasPendingCompletion);

        // 如果有待处理的补全，接受它
        if (hasPendingCompletion && this.options.acceptKeys?.includes("Tab")) {
          console.log("✅ Accepting suggestion via Tab");
          return editor.commands.acceptSuggestion();
        }

        // 如果没有待处理的补全且 Tab 是请求键，请求新建议
        if (!hasPendingCompletion && this.options.requestKey === "Tab") {
          console.log("🎯 Requesting new suggestion via Tab");
          return editor.commands.requestSuggestion();
        }

        console.log("❌ Tab not handled, returning false");
        return false;
      },

      Enter: ({ editor }) => {
        if (
          !this.options.enabled ||
          !this.options.acceptKeys?.includes("Enter")
        )
          return false;

        const editorId = editor.storage.aiAutocomplete?.editorId;
        const handlers = globalHandlers.get(editorId);
        if (!handlers) return false;

        const hasPendingCompletion = handlers.hasPendingCompletion();
        if (hasPendingCompletion) {
          return editor.commands.acceptSuggestion();
        }

        return false;
      },

      ArrowRight: ({ editor }) => {
        if (
          !this.options.enabled ||
          !this.options.acceptKeys?.includes("ArrowRight")
        )
          return false;

        const editorId = editor.storage.aiAutocomplete?.editorId;
        const handlers = globalHandlers.get(editorId);
        if (!handlers) return false;

        const hasPendingCompletion = handlers.hasPendingCompletion();
        if (hasPendingCompletion) {
          return editor.commands.acceptSuggestion();
        }

        return false;
      },

      Escape: ({ editor }) => {
        if (!this.options.enabled || this.options.dismissKey !== "Escape")
          return false;

        const editorId = editor.storage.aiAutocomplete?.editorId;
        const handlers = globalHandlers.get(editorId);
        if (!handlers) return false;

        const hasPendingCompletion = handlers.hasPendingCompletion();
        if (hasPendingCompletion) {
          return editor.commands.dismissSuggestion();
        }

        return false;
      },
    };
  },

  onDestroy() {
    // 扩展销毁时清理处理器
    globalHandlers.delete(this.storage.editorId);
  },
});

// 导出函数供 hook 注册处理器
export function registerAIAutocompleteHandlers(
  editorId: string,
  handlers: {
    acceptSuggestion: () => boolean;
    dismissSuggestion: () => boolean;
    requestSuggestion: () => void;
    hasPendingCompletion: () => boolean;
  }
) {
  globalHandlers.set(editorId, handlers);
}

// 导出函数供 hook 注销处理器
export function unregisterAIAutocompleteHandlers(editorId: string) {
  globalHandlers.delete(editorId);
}

// 调试用导出
export function getGlobalHandlers() {
  return globalHandlers;
}
