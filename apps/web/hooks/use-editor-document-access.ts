"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import type { EditorDocument } from "@repo/database";
import { useGetDocument } from "@/hooks/use-document-query";
import { useWorkspace } from "@/components/workspace-provider";

export type DocumentAccessLevel = "owner" | "edit" | "view";

export type EditorDocumentFetchError = {
  message: string;
  statusCode?: number;
  cause?: string;
};

export type EditorDocumentPageStatus =
  | "loading"
  | "ready"
  | "workspace_mismatch"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "error";

type EditorDocumentWithAccess = EditorDocument & {
  accessLevel?: DocumentAccessLevel;
};

function parseDocumentError(error: unknown): EditorDocumentFetchError | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const docError = error as EditorDocumentFetchError;
  return {
    message: docError.message || "加载文档时发生错误，请稍后重试",
    statusCode: docError.statusCode,
    cause: docError.cause,
  };
}

function requiresWorkspaceMatch(params: {
  accessLevel?: DocumentAccessLevel;
  documentWorkspaceId: string | null | undefined;
  accessibleWorkspaceIds: string[];
}): boolean {
  const { accessLevel, documentWorkspaceId, accessibleWorkspaceIds } = params;

  if (accessLevel === "owner") {
    return true;
  }

  if (!documentWorkspaceId) {
    return false;
  }

  return accessibleWorkspaceIds.includes(documentWorkspaceId);
}

export function useEditorDocumentAccess(documentId: string) {
  const router = useRouter();
  const params = useParams();
  const { currentWorkspace, workspaces, switchWorkspace } = useWorkspace();
  const {
    data: document,
    isPending,
    error,
  } = useGetDocument(documentId, { metadataOnly: true });

  const docError = parseDocumentError(error);
  const documentWithAccess = document as EditorDocumentWithAccess | undefined;
  const accessLevel = documentWithAccess?.accessLevel;

  const accessibleWorkspaceIds = useMemo(
    () => workspaces.map((workspace) => workspace.id),
    [workspaces]
  );

  const slugParam = params.slug;
  let workspaceSlugFromParams = "";
  if (typeof slugParam === "string") {
    workspaceSlugFromParams = slugParam;
  } else if (Array.isArray(slugParam) && slugParam[0]) {
    workspaceSlugFromParams = slugParam[0];
  }

  const workspaceSlug =
    workspaceSlugFromParams || currentWorkspace?.slug || "";
  const listWorkspaceId = document?.workspaceId ?? currentWorkspace?.id;

  const workspaceMismatch = useMemo(() => {
    if (isPending || !document || docError) {
      return {
        isMismatch: false,
        targetWorkspace: undefined,
        targetWorkspaceName: "其他空间",
      };
    }

    const documentWorkspaceId = document.workspaceId;
    const hasDifferentWorkspace =
      documentWorkspaceId != null &&
      currentWorkspace?.id != null &&
      documentWorkspaceId !== currentWorkspace.id;

    const shouldRequireWorkspaceMatch = requiresWorkspaceMatch({
      accessLevel,
      documentWorkspaceId,
      accessibleWorkspaceIds,
    });

    const isMismatch = hasDifferentWorkspace && shouldRequireWorkspaceMatch;
    const targetWorkspace = isMismatch
      ? workspaces.find((workspace) => workspace.id === documentWorkspaceId)
      : undefined;
    const targetWorkspaceName =
      targetWorkspace?.name ?? targetWorkspace?.slug ?? "其他空间";

    return {
      isMismatch,
      targetWorkspace,
      targetWorkspaceName,
    };
  }, [
    accessLevel,
    accessibleWorkspaceIds,
    currentWorkspace?.id,
    docError,
    document,
    isPending,
    workspaces,
  ]);

  const pageStatus = useMemo((): EditorDocumentPageStatus => {
    if (isPending) {
      return "loading";
    }

    if (docError) {
      const statusCode = docError.statusCode ?? 0;
      if (statusCode === 401) {
        return "unauthorized";
      }
      if (statusCode === 403) {
        return "forbidden";
      }
      if (statusCode === 404) {
        return "not_found";
      }
      return "error";
    }

    if (workspaceMismatch.isMismatch) {
      return "workspace_mismatch";
    }

    return "ready";
  }, [docError, isPending, workspaceMismatch.isMismatch]);

  useEffect(() => {
    if (
      docError &&
      !isPending &&
      docError.statusCode === 403 &&
      docError.cause === "document_deleted"
    ) {
      router.replace("/editor");
    }
  }, [docError, isPending, router]);

  const goToDocumentWorkspace = useCallback(async () => {
    if (!document?.workspaceId) {
      return;
    }

    const targetWorkspace = workspaces.find(
      (workspace) => workspace.id === document.workspaceId
    );
    if (!targetWorkspace) {
      return;
    }

    await switchWorkspace(targetWorkspace);
    router.replace(`/${targetWorkspace.slug}/editor/${documentId}`);
  }, [document?.workspaceId, documentId, router, switchWorkspace, workspaces]);

  return {
    document: documentWithAccess,
    isPending,
    accessLevel,
    pageStatus,
    error: docError,
    workspaceMismatch,
    workspaceSlug,
    listWorkspaceId,
    goToDocumentWorkspace,
  };
}
