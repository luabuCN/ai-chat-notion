"use client";

/**
 * 文档导入客户端 action hook。
 *
 * 流程：
 * 1. 创建空文档（标题 = 文件名）
 * 2. 跳转到编辑器页面
 * 3. 后台运行 SSE 解析（不阻塞，切换文档不中断）
 * 4. 解析完成后 markdownToTiptap 并 PATCH 保存内容
 *
 * 任务状态存在 convert-store，编辑器页面订阅并展示 overlay。
 */

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";
import { documentKeys } from "@/hooks/use-document-query";
import { useWorkspace } from "@/components/workspace-provider";
import { apiFetch } from "@/lib/api-client";
import { uploadFileToApi } from "@/lib/file-upload";
import { htmlToTiptap, markdownToTiptap } from "@repo/editor";
import { pollJobUntilComplete } from "@/lib/jobs/poll-job";
import type { DocumentImportJobResult } from "@/lib/jobs/types";
import {
  clearConvertTask,
  failConvertTask,
  finishConvertTask,
  isDocumentImportBusy,
  startConvertTask,
  updateConvertProgress,
} from "./convert-store";
import {
  getDocumentTitleFromFileName,
  isPdfImportFile,
  isSupportedDocumentImport,
} from "./constants";

type CreatedDoc = { id: string; title: string };

async function createDocument(
  title: string,
  workspaceId?: string | null
): Promise<CreatedDoc> {
  const res = await apiFetch("/api/editor-documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, workspaceId: workspaceId ?? null }),
  });
  if (!res.ok) throw new Error("创建文档失败");
  return res.json() as Promise<CreatedDoc>;
}

type ImportContentFormat = "markdown" | "html";

/** 将导入内容转为 Tiptap JSON 并保存到文档（清空 yjsState，避免协同层沿用空 CRDT） */
async function saveDocumentContent(
  docId: string,
  payload: {
    contentFormat: ImportContentFormat;
    markdown: string;
    html?: string;
  }
) {
  const doc =
    payload.contentFormat === "html" && payload.html
      ? htmlToTiptap(payload.html)
      : markdownToTiptap(payload.markdown);
  const res = await apiFetch(`/api/editor-documents/${docId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: JSON.stringify(doc),
      yjsState: null,
    }),
  });
  if (!res.ok) throw new Error("保存文档失败");
}

async function runImportViaJob(
  file: File,
  docId: string,
  queryClient: QueryClient
) {
  updateConvertProgress(docId, "正在上传并排队解析...");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("docId", docId);
  formData.append("polish", "auto");

  const res = await apiFetch("/api/document-import/jobs", {
    method: "POST",
    body: formData,
  });

  if (res.status === 503) {
    await runImportViaSse(file, docId, queryClient);
    return;
  }

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "文档解析任务创建失败");
  }

  const { jobId } = (await res.json()) as { jobId: string };
  const result = await pollJobUntilComplete<DocumentImportJobResult>(
    jobId,
    (progress) => updateConvertProgress(docId, progress)
  );

  if (result.warnings?.length) {
    toast.warning(result.warnings.join("\n"), { duration: 8000 });
  }

  finishConvertTask(docId, result.markdown);
  updateConvertProgress(docId, "正在保存文档...");
  await saveDocumentContent(docId, {
    contentFormat: result.contentFormat,
    markdown: result.markdown,
    html: result.html,
  });

  await queryClient.invalidateQueries({
    queryKey: documentKeys.detail(docId),
  });

  toast.success("文档已导入并保存");
  clearConvertTask(docId);
}

async function runImportViaSse(
  file: File,
  docId: string,
  queryClient: QueryClient
) {
  updateConvertProgress(docId, "正在解析文档...");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("polish", "auto");

  const res = await apiFetch("/api/document-import/parse", {
    method: "POST",
    body: formData,
  });

  if (!res.ok || !res.body) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "文档解析失败");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = "";
  let finalMarkdown = "";
  let contentFormat: ImportContentFormat = "markdown";
  let finalHtml: string | undefined;

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
        | {
            type: "done";
            contentFormat: ImportContentFormat;
            markdown: string;
            rawMarkdown: string;
            html?: string;
            pageCount?: number;
            warnings?: string[];
          }
        | { type: "error"; message: string };

      if (json.type === "progress") {
        updateConvertProgress(docId, json.message);
      } else if (json.type === "done") {
        finalMarkdown = json.markdown;
        contentFormat = json.contentFormat;
        finalHtml = json.html;
        if (json.warnings && json.warnings.length > 0) {
          toast.warning(json.warnings.join("\n"), { duration: 8000 });
        }
        finishConvertTask(docId, json.markdown);
      } else if (json.type === "error") {
        throw new Error(json.message);
      }
    }
  }

  updateConvertProgress(docId, "正在保存文档...");
  await saveDocumentContent(docId, {
    contentFormat,
    markdown: finalMarkdown,
    html: finalHtml,
  });

  await queryClient.invalidateQueries({
    queryKey: documentKeys.detail(docId),
  });

  toast.success("文档已导入并保存");
  clearConvertTask(docId);
}

async function runImportInBackground(
  file: File,
  docId: string,
  queryClient: QueryClient
) {
  try {
    await runImportViaJob(file, docId, queryClient);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "文档导入失败，请重试";
    failConvertTask(docId, msg);
    toast.error(msg);
  }
}

export function useDocumentImportUpload({
  workspaceSlug,
}: {
  workspaceSlug?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { workspaces, currentWorkspace } = useWorkspace();

  const handleDocumentImportUpload = useCallback(
    async (file: File): Promise<void> => {
      if (!isSupportedDocumentImport(file)) {
        toast.error("请选择 PDF、Word DOCX 或 Markdown 文件");
        return;
      }
      if (isDocumentImportBusy()) {
        toast.error("已有文档正在导入或保存中，请稍后再试");
        return;
      }

      const toastId = toast.loading("正在创建文档...");

      try {
        const title = getDocumentTitleFromFileName(file.name);

        const workspaceId =
          workspaceSlug && workspaces.length > 0
            ? (workspaces.find((w) => w.slug === workspaceSlug)?.id ??
              currentWorkspace?.id ??
              null)
            : (currentWorkspace?.id ?? null);

        const doc = await createDocument(title, workspaceId);

        await queryClient.invalidateQueries({ queryKey: documentKeys.lists() });

        if (isPdfImportFile(file)) {
          try {
            const { url } = await uploadFileToApi(file);
            const patchRes = await apiFetch(`/api/editor-documents/${doc.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sourcePdfUrl: url }),
            });
            if (!patchRes.ok) {
              throw new Error("保存原文档链接失败");
            }
            await queryClient.invalidateQueries({
              queryKey: documentKeys.detail(doc.id),
            });
          } catch {
            // 原文上传失败时仍继续导入，仅无「下载原文档」入口
          }
        }

        toast.dismiss(toastId);

        startConvertTask(doc.id, "正在准备导入...");

        const editorPath = workspaceSlug
          ? `/${workspaceSlug}/editor/${doc.id}`
          : `/editor/${doc.id}`;
        router.push(editorPath);

        void runImportInBackground(file, doc.id, queryClient);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "操作失败，请重试",
          { id: toastId }
        );
      }
    },
    [workspaceSlug, workspaces, currentWorkspace?.id, router, queryClient]
  );

  return { handleDocumentImportUpload };
}
