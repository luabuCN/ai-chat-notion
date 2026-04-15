import { getAuthFromRequest } from "@/lib/api-auth";
import {
  createEditorDocument,
  getEditorDocumentById,
  getEditorDocumentsByUserId,
  getWorkspaceBySlug,
} from "@repo/database";
import { ChatSDKError } from "@/lib/errors";
import { verifyWorkspaceAccess } from "@/lib/workspace-access";

export async function GET(request: Request) {
  const { user } = getAuthFromRequest(request);

  if (!user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  const { searchParams } = new URL(request.url);
  const parentDocumentId = searchParams.get("parentDocumentId");
  const workspaceId = searchParams.get("workspaceId");
  const includeDeleted = searchParams.get("includeDeleted") === "true";
  const onlyDeleted = searchParams.get("onlyDeleted") === "true";

  // 如果指定了 workspaceId，验证访问权限
  if (workspaceId) {
    const hasAccess = await verifyWorkspaceAccess(workspaceId);
    if (!hasAccess) {
      return new ChatSDKError(
        "unauthorized:document",
        "Access denied"
      ).toResponse();
    }
  }

  try {
    const documents = await getEditorDocumentsByUserId({
      userId: user.id,
      workspaceId: workspaceId ?? undefined,
      parentDocumentId: parentDocumentId ?? null,
      includeDeleted,
      onlyDeleted,
    });

    return Response.json(documents, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to get editor documents"
    ).toResponse();
  }
}

export async function POST(request: Request) {
  const { user } = getAuthFromRequest(request);

  if (!user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  try {
    const body = await request.json();
    const {
      title,
      content,
      workspaceId,
      workspaceSlug,
      parentDocumentId,
      coverImage,
      coverImageType,
      sourcePageUrl,
    }: {
      title: string;
      content?: string;
      workspaceId?: string | null;
      workspaceSlug?: string;
      parentDocumentId?: string | null;
      coverImage?: string | null;
      coverImageType?: "color" | "url" | null;
      /** 扩展侧栏等从网页剪藏时传入的原文 URL */
      sourcePageUrl?: string | null;
    } = body;

    if (!title) {
      return new ChatSDKError(
        "bad_request:api",
        "Title is required"
      ).toResponse();
    }

    let resolvedWorkspaceId = workspaceId ?? null;

    if (!resolvedWorkspaceId && workspaceSlug) {
      const workspace = await getWorkspaceBySlug({ slug: workspaceSlug });
      if (workspace) {
        resolvedWorkspaceId = workspace.id;
      }
    }

    if (!resolvedWorkspaceId && parentDocumentId) {
      try {
        const parentDoc = await getEditorDocumentById({ id: parentDocumentId });
        resolvedWorkspaceId = parentDoc.workspaceId;
      } catch {
        // 父文档不存在时忽略
      }
    }

    if (resolvedWorkspaceId) {
      const hasAccess = await verifyWorkspaceAccess(resolvedWorkspaceId);
      if (!hasAccess) {
        return new ChatSDKError(
          "unauthorized:document",
          "Access denied"
        ).toResponse();
      }
    }

    const document = await createEditorDocument({
      title,
      content,
      userId: user.id,
      workspaceId: resolvedWorkspaceId,
      parentDocumentId: parentDocumentId ?? null,
      coverImage: coverImage ?? null,
      coverImageType: coverImageType ?? "url",
      sourcePageUrl,
    });

    return Response.json(document, { status: 201 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to create editor document"
    ).toResponse();
  }
}
