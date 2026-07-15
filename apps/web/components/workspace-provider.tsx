"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Workspace } from "./workspace-switcher";
import { apiFetch } from "@/lib/api-client";
import {
  documentKeys,
  fetchAllDocuments,
} from "@/hooks/use-document-query";

export const workspaceKeys = {
  all: ["workspaces"] as const,
};

interface WorkspaceContextValue {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  isLoading: boolean;
  switchWorkspace: (workspace: Workspace) => Promise<boolean>;
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (name: string, icon?: string) => Promise<Workspace | null>;
  applyWorkspaceUpdate: (
    workspaceId: string,
    updates: Pick<Workspace, "name" | "icon" | "slug">
  ) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

async function fetchWorkspaces(): Promise<Workspace[]> {
  const response = await apiFetch("/api/workspaces");
  if (!response.ok) {
    throw new Error("Failed to fetch workspaces");
  }
  return response.json();
}

function getDefaultWorkspace(
  workspaces: Workspace[],
  userId?: string
): Workspace | null {
  if (workspaces.length === 0) {
    return null;
  }

  if (userId) {
    const ownedWorkspace = workspaces.find(
      (workspace) => workspace.ownerId === userId
    );
    if (ownedWorkspace) {
      return ownedWorkspace;
    }
  }

  return workspaces[0];
}

export function WorkspaceProvider({
  children,
  userId,
}: {
  children: ReactNode;
  userId?: string;
}) {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string | undefined;
  const queryClient = useQueryClient();
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(
    null
  );
  const currentWorkspaceRef = useRef<Workspace | null>(null);
  const redirectingFromRemovedWorkspaceRef = useRef(false);
  /** 乐观切换目标：URL slug 尚未跟上时，禁止 sync effect 回写旧空间 */
  const pendingSwitchIdRef = useRef<string | null>(null);

  const {
    data: workspaces = [],
    isLoading,
  } = useQuery({
    queryKey: workspaceKeys.all,
    queryFn: fetchWorkspaces,
    staleTime: 60_000,
    retry: 2,
  });

  useEffect(() => {
    currentWorkspaceRef.current = currentWorkspace;
  }, [currentWorkspace]);

  // Sync current workspace with URL slug
  useEffect(() => {
    if (workspaces.length === 0 || !slug) {
      return;
    }

    const workspace = workspaces.find((w) => w.slug === slug);
    if (!workspace) {
      return;
    }

    if (pendingSwitchIdRef.current) {
      if (workspace.id === pendingSwitchIdRef.current) {
        pendingSwitchIdRef.current = null;
        setCurrentWorkspace(workspace);
      }
      // URL 仍是旧 slug：保留乐观更新的 currentWorkspace，避免回退
      return;
    }

    setCurrentWorkspace((prev) =>
      prev?.id === workspace.id ? prev : workspace
    );
  }, [slug, workspaces]);

  // Pick default workspace once list is available
  useEffect(() => {
    if (workspaces.length === 0 || currentWorkspaceRef.current) {
      return;
    }

    const matchingWorkspace = slug
      ? workspaces.find((w) => w.slug === slug)
      : undefined;
    setCurrentWorkspace(matchingWorkspace || getDefaultWorkspace(workspaces, userId));
  }, [slug, workspaces, userId]);

  // 当前 URL 对应的空间已被移除时，自动跳转到默认空间（优先自有空间）
  useEffect(() => {
    if (isLoading || workspaces.length === 0 || !slug) {
      return;
    }

    const hasAccess = workspaces.some((workspace) => workspace.slug === slug);
    if (hasAccess) {
      redirectingFromRemovedWorkspaceRef.current = false;
      return;
    }

    if (redirectingFromRemovedWorkspaceRef.current) {
      return;
    }

    const defaultWorkspace = getDefaultWorkspace(workspaces, userId);
    if (!defaultWorkspace) {
      return;
    }

    redirectingFromRemovedWorkspaceRef.current = true;
    pendingSwitchIdRef.current = defaultWorkspace.id;
    setCurrentWorkspace(defaultWorkspace);

    void (async () => {
      try {
        const response = await apiFetch("/api/workspaces/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId: defaultWorkspace.id }),
        });
        if (!response.ok) {
          redirectingFromRemovedWorkspaceRef.current = false;
          return;
        }
        router.replace(`/${defaultWorkspace.slug}/chat`);
      } catch {
        redirectingFromRemovedWorkspaceRef.current = false;
      }
    })();
  }, [slug, workspaces, isLoading, router, userId]);

  const refreshWorkspaces = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
  }, [queryClient]);

  const switchWorkspace = useCallback(
    async (workspace: Workspace): Promise<boolean> => {
      if (workspace.id === currentWorkspaceRef.current?.id) {
        return true;
      }

      const previous = currentWorkspaceRef.current;
      pendingSwitchIdRef.current = workspace.id;
      setCurrentWorkspace(workspace);

      try {
        const response = await apiFetch("/api/workspaces/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId: workspace.id }),
        });

        if (!response.ok) {
          pendingSwitchIdRef.current = null;
          setCurrentWorkspace(previous);
          return false;
        }

        // 预取最近访问，导航 remount 后直接命中缓存，避免卡片骨架再闪一次
        void queryClient.prefetchQuery({
          queryKey: documentKeys.allDocsList(
            workspace.id,
            undefined,
            true,
            "workspace",
            12
          ),
          queryFn: () =>
            fetchAllDocuments(workspace.id, undefined, true, "workspace", 12),
        });

        return true;
      } catch (error) {
        pendingSwitchIdRef.current = null;
        setCurrentWorkspace(previous);
        console.error("Failed to switch workspace:", error);
        return false;
      }
    },
    [queryClient]
  );

  const applyWorkspaceUpdate = useCallback(
    (
      workspaceId: string,
      updates: Pick<Workspace, "name" | "icon" | "slug">
    ) => {
      queryClient.setQueryData<Workspace[]>(workspaceKeys.all, (prev) =>
        prev?.map((w) =>
          w.id === workspaceId ? { ...w, ...updates } : w
        )
      );
      setCurrentWorkspace((prev) =>
        prev?.id === workspaceId ? { ...prev, ...updates } : prev
      );
    },
    [queryClient]
  );

  const createWorkspace = useCallback(
    async (name: string, icon?: string): Promise<Workspace | null> => {
      try {
        const response = await apiFetch("/api/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, icon }),
        });

        if (response.ok) {
          const workspace = await response.json();
          queryClient.setQueryData<Workspace[]>(workspaceKeys.all, (prev) =>
            prev ? [...prev, workspace] : [workspace]
          );
          pendingSwitchIdRef.current = workspace.id;
          setCurrentWorkspace(workspace);
          return workspace;
        }
      } catch (error) {
        console.error("Failed to create workspace:", error);
      }
      return null;
    },
    [queryClient]
  );

  useEffect(() => {
    const handler = () => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    };
    window.addEventListener("refresh-workspaces", handler);
    return () => window.removeEventListener("refresh-workspaces", handler);
  }, [queryClient]);

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspace,
        workspaces,
        isLoading,
        switchWorkspace,
        refreshWorkspaces,
        createWorkspace,
        applyWorkspaceUpdate,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
