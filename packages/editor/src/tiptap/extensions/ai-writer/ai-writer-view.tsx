import { Alert } from "../../../ui/alert";
import { Button } from "@repo/ui/button";
import { Textarea } from "@repo/ui/textarea";
import { NodeViewProps } from "@tiptap/core";
import { NodeViewWrapper, useEditorState } from "@tiptap/react";
import {
  CheckIcon,
  LoaderCircleIcon,
  SparklesIcon,
  Trash2Icon,
  WandSparklesIcon,
  CopyIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";

const AiWriterView = ({ editor, node, getPos }: NodeViewProps) => {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);

  const { message, status, error } = useEditorState({
    editor: editor,
    selector: (instance) => {
      const storage = instance.editor.storage.ai;
      return {
        status: storage.status,
        message: storage.message,
        error: storage.error,
      };
    },
  });

  const isLoading = status === "loading";
  const isSuccess = status === "success";

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(id);
    };
  }, []);

  // 流式生成时自动滚动到底部
  useEffect(() => {
    if (isLoading && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [message, isLoading]);

  const insert = () => {
    if (!message) {
      return;
    }

    const from = getPos();
    if (from === undefined) {
      return;
    }
    const to = from + node.nodeSize;

    // 使用 markdown 扩展的 manager.parse 方法来解析 markdown
    const manager = editor.storage.markdown?.manager;
    if (manager) {
      try {
        const json = manager.parse(message);
        editor
          .chain()
          .focus()
          .deleteRange({ from, to })
          .insertContentAt(from, json.content || [])
          .run();
        return;
      } catch (e) {
        console.error("Failed to parse markdown:", e);
      }
    }

    // fallback: 直接插入文本
    editor
      .chain()
      .focus()
      .deleteRange({ from, to })
      .insertContentAt(from, message)
      .run();
  };

  const remove = () => {
    const from = getPos();
    if (from === undefined) {
      return;
    }
    const to = from + node.nodeSize;
    editor.chain().focus().deleteRange({ from, to }).run();
  };

  const copyToClipboard = async () => {
    if (message) {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const regenerate = () => {
    const prompt = inputRef.current?.value;
    if (!prompt?.trim()) return;

    editor.commands.aiTextPrompt({
      prompt: prompt,
      command: "prompt",
      insert: false,
    });
  };

  return (
    <NodeViewWrapper>
      <div className="ai-writer relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-b from-background to-muted/20 shadow-lg">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
            <SparklesIcon className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">
              AI 写作助手
            </h3>
            <p className="text-xs text-muted-foreground">
              输入提示词，让 AI 为你生成内容
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={remove}
          >
            <Trash2Icon className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4">
          {error && (
            <Alert variant="destructive" className="mb-4">
              {error.message}
            </Alert>
          )}

          {/* Preview Area */}
          {!error && !!message && (
            <div className="mb-4 overflow-hidden rounded-lg border border-border/50 bg-background">
              <div className="flex items-center justify-between border-b border-border/50 bg-muted/20 px-3 py-2">
                <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <WandSparklesIcon className="h-3.5 w-3.5" />
                  生成结果
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={copyToClipboard}
                  >
                    {copied ? (
                      <CheckIcon className="mr-1 h-3 w-3" />
                    ) : (
                      <CopyIcon className="mr-1 h-3 w-3" />
                    )}
                    {copied ? "已复制" : "复制"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={regenerate}
                    disabled={isLoading}
                  >
                    <RotateCcwIcon className="mr-1 h-3 w-3" />
                    重新生成
                  </Button>
                </div>
              </div>
              <div ref={scrollRef} className="max-h-64 overflow-y-auto">
                <div className="prose prose-sm dark:prose-invert prose-headings:mt-0 prose-p:my-2 prose-pre:rounded-md prose-pre:bg-gray-800 dark:prose-pre:bg-gray-900 max-w-full p-4">
                  <Markdown>{message}</Markdown>
                </div>
              </div>
            </div>
          )}

          {/* Input Area */}
          <form
            onSubmit={(evt) => {
              evt.preventDefault();
              const prompt = inputRef.current?.value;

              if (!prompt?.trim()) {
                return;
              }

              editor.commands.aiTextPrompt({
                prompt: prompt,
                command: "prompt",
                insert: false,
              });
            }}
          >
            <div className="relative">
              <Textarea
                ref={inputRef}
                name="prompt"
                placeholder="描述你想要生成的内容，例如：写一段关于人工智能的介绍..."
                className="min-h-[100px] resize-none rounded-lg border-border/50 bg-background pr-4 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-violet-500/50"
                autoFocus
              />
            </div>

            {/* Actions */}
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                按 Enter 换行，点击按钮生成
              </p>
              <div className="flex items-center gap-2">
                {isSuccess && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 border-green-500/30 bg-green-500/10 text-green-600 hover:bg-green-500/20 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                    disabled={isLoading}
                    onClick={insert}
                  >
                    <CheckIcon className="mr-1.5 h-4 w-4" />
                    插入内容
                  </Button>
                )}
                <Button
                  type="submit"
                  size="sm"
                  className="h-9 bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-sm hover:from-violet-600 hover:to-purple-700"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <LoaderCircleIcon className="mr-1.5 h-4 w-4 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="mr-1.5 h-4 w-4" />
                      生成
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-violet-500/5 via-purple-500/5 to-violet-500/5 animate-pulse" />
        )}
      </div>
    </NodeViewWrapper>
  );
};

export default AiWriterView;
