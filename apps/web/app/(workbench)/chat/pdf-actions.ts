"use client";

/**
 * PDF 转文档的客户端 action hook。
 *
 * 流程：
 * 1. 创建空文档（标题 = 文件名）
 * 2. 跳转到编辑器页面
 * 3. 后台运行 SSE 转换（不阻塞，切换文档不中断）
 * 4. 转换完成后 PATCH 保存内容
 *
 * 任务状态存在 convert-store（模块级 Map），编辑器页面订阅并展示 overlay。
 */

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { fetcher } from "@/lib/utils";
import {
  startConvertTask,
  updateConvertProgress,
  finishConvertTask,
  failConvertTask,
  clearConvertTask,
} from "@/lib/pdf/convert-store";
import { markdownToTiptapJson } from "@/lib/pdf/markdown-to-tiptap";

// ─── 类型 ────────────────────────────────────────────────────

type Workspace = { id: string; slug: string; name: string };

type CreatedDoc = { id: string; title: string };

// ─── 纯函数（不依赖 React） ───────────────────────────────────

async function createDocument(
  title: string,
  workspaceId?: string | null
): Promise<CreatedDoc> {
  const res = await fetch("/api/editor-documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, workspaceId: workspaceId ?? null }),
  });
  if (!res.ok) throw new Error("创建文档失败");
  return res.json() as Promise<CreatedDoc>;
}

/** 将 markdown 转为 Tiptap JSON 并保存到文档 */
async function saveDocumentContent(docId: string, markdown: string) {
  const doc = markdownToTiptapJson(markdown);
  const res = await fetch(`/api/editor-documents/${docId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: JSON.stringify(doc) }),
  });
  if (!res.ok) throw new Error("保存文档失败");
}

/**
 * 后台运行 PDF 转换（不 await，跳转后继续执行）。
 * 通过 convert-store 广播进度，编辑器 overlay 订阅展示。
 */
async function runConvertInBackground(file: File, docId: string) {
  try {
    startConvertTask(docId, "正在提取 PDF 文字和图片位置...");

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/pdf/parse", {
      method: "POST",
      body: formData,
    });

    if (!res.ok || !res.body) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? "PDF 解析失败");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = "";
    let finalMarkdown = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      sseBuffer += decoder.decode(value, { stream: true });
      const chunks = sseBuffer.split("\n\n");
      sseBuffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const dataLine = chunk.trim();
        if (!dataLine.startsWith("data: ")) continue;

        const json = JSON.parse(dataLine.slice(6)) as
          | { type: "progress"; message: string }
          | { type: "done"; markdown: string; rawMarkdown: string; pageCount: number }
          | { type: "error"; message: string };

        if (json.type === "progress") {
          updateConvertProgress(docId, json.message);
        } else if (json.type === "done") {
          finalMarkdown = json.markdown;
          finishConvertTask(docId, json.markdown);
        } else if (json.type === "error") {
          throw new Error(json.message);
        }
      }
    }

    updateConvertProgress(docId, "正在保存文档...");
    await saveDocumentContent(docId, finalMarkdown);

    toast.success("PDF 已转换并保存到文档");
    clearConvertTask(docId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "PDF 转换失败，请重试";
    failConvertTask(docId, msg);
    toast.error(msg);
  }
}

// ─── Hook ────────────────────────────────────────────────────

/**
 * 返回 handlePdfUpload(file)：
 * - 创建文档 → 跳转编辑器 → 后台转换（不阻塞）
 */
export function usePdfUpload({ workspaceSlug }: { workspaceSlug?: string }) {
  const router = useRouter();

  // 拿 workspaces 列表，从 slug 找 workspaceId
  const { data: workspaces } = useSWR<Workspace[]>("/api/workspaces", fetcher);

  const handlePdfUpload = useCallback(
    async (file: File): Promise<void> => {
      if (file.type !== "application/pdf") {
        toast.error("请选择 PDF 文件");
        return;
      }

      const toastId = toast.loading("正在创建文档...");

      try {
        const title = file.name.replace(/\.pdf$/i, "").trim() || "未命名文档";

        // 找到当前 workspace 的 id
        const workspaceId =
          workspaceSlug && workspaces
            ? (workspaces.find((w) => w.slug === workspaceSlug)?.id ?? null)
            : null;

        // 1. 创建空文档
        const doc = await createDocument(title, workspaceId);

        toast.dismiss(toastId);

        // 2. 跳转到编辑器
        const editorPath = workspaceSlug
          ? `/${workspaceSlug}/editor/${doc.id}`
          : `/editor/${doc.id}`;
        router.push(editorPath);

        // 3. 后台转换（不 await，跳转后继续）
        void runConvertInBackground(file, doc.id);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "操作失败，请重试",
          { id: toastId }
        );
      }
    },
    [workspaceSlug, workspaces, router]
  );

  return { handlePdfUpload };
}
