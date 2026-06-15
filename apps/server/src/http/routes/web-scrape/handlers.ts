import type { Context } from "hono";
import {
  createEditorDocument,
  createWebPageScrape,
  getWorkspaceBySlug,
} from "@repo/database";
import { getSessionFromRequest } from "../../../shared/auth.js";
import { ApiError } from "../../../shared/errors.js";
import {
  resolveScrapeTitle,
  scrapeUrlWithFirecrawl,
} from "../../../shared/firecrawl.js";
import { verifyWorkspaceAccess } from "../../../shared/workspace-access.js";

function normalizeHttpUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("请输入网页链接");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("链接格式不正确");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("仅支持 http 或 https 链接");
  }

  return parsed.toString();
}

export async function scrapeWebPageHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:document").toResponse();
  }

  const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
  if (!apiKey) {
    return new ApiError(
      "offline:api",
      "网页抓取服务未配置，请联系管理员"
    ).toResponse();
  }

  try {
    const body = await c.req.json();
    const {
      url,
      workspaceId,
      workspaceSlug,
      excludeTags,
      includeTags,
    }: {
      url: string;
      workspaceId?: string | null;
      workspaceSlug?: string;
      excludeTags?: string[];
      includeTags?: string[];
    } = body;

    const sourceUrl = normalizeHttpUrl(url);

    let resolvedWorkspaceId = workspaceId ?? null;
    if (!resolvedWorkspaceId && workspaceSlug) {
      const workspace = await getWorkspaceBySlug({ slug: workspaceSlug });
      if (workspace) {
        resolvedWorkspaceId = workspace.id;
      }
    }

    if (resolvedWorkspaceId) {
      const hasAccess = await verifyWorkspaceAccess(
        resolvedWorkspaceId,
        session
      );
      if (!hasAccess) {
        return new ApiError(
          "unauthorized:document",
          "无权访问该工作区"
        ).toResponse();
      }
    }

    const scrapeData = await scrapeUrlWithFirecrawl(sourceUrl, apiKey, {
      excludeTags,
      includeTags,
    });
    const markdown = scrapeData.markdown?.trim() ?? "";
    const title = resolveScrapeTitle(sourceUrl, scrapeData.metadata);

    const document = await createEditorDocument({
      title,
      content: "",
      userId: session.user.id,
      workspaceId: resolvedWorkspaceId,
      sourcePageUrl: sourceUrl,
    });

    await createWebPageScrape({
      documentId: document.id,
      sourceUrl,
      markdown,
      html: scrapeData.html ?? null,
      rawHtml: scrapeData.rawHtml ?? null,
      summary: scrapeData.summary ?? null,
      metadata: scrapeData.metadata ?? null,
      warning: scrapeData.warning ?? null,
    });

    return c.json(
      {
        id: document.id,
        title: document.title,
        sourcePageUrl: document.sourcePageUrl,
        markdown,
        warning: scrapeData.warning ?? null,
      },
      201
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return error.toResponse();
    }

    const message =
      error instanceof Error ? error.message : "网页保存失败，请重试";
    return new ApiError("bad_request:api", message).toResponse();
  }
}
