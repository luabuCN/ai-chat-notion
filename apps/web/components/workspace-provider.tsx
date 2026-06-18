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
import { useParams } from "next/navigation";
import type { Workspace } from "./workspace-switcher";
import { apiFetch } from "@/lib/api-client";

interface WorkspaceContextValue {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  isLoading: boolean;
  switchWorkspace: (workspace: Workspace) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (name: string, icon?: string) => Promise<Workspace | null>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function workspaceMemberFingerprint(workspace: Workspace | undefined): string {
  const member = workspace?.members?.[0];
  return member ? `${member.role}:${member.permission}` : "";
}

function isSameWorkspace(a: Workspace, b: Workspace): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.slug === b.slug &&
    a.icon === b.icon &&
    a.ownerId === b.ownerId &&
    a._count.members === b._count.members &&
    workspaceMemberFingerprint(a) === workspaceMemberFingerprint(b)
  );
}

function isSameWorkspaceList(a: Workspace[], b: Workspace[]): boolean {
  return (
    a.length === b.length && a.every((workspace, index) => isSameWorkspace(workspace, b[index]))
  );
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const slug = params?.slug as string | undefined;
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(
    null
  );
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const currentWorkspaceIdRef = useRef<string | null>(null);

  useEffect(() => {
    currentWorkspaceIdRef.current = currentWorkspace?.id ?? null;
  }, [currentWorkspace?.id]);

  // Sync current workspace with URL slug
  useEffect(() => {
    if (workspaces.length > 0 && slug) {
      const workspace = workspaces.find((w) => w.slug === slug);
      if (workspace && workspace.id !== currentWorkspace?.id) {
        setCurrentWorkspace(workspace);
      }
    }
  }, [slug, workspaces, currentWorkspace]);

  const refreshWorkspaces = useCallback(async () => {
    try {
      const response = await apiFetch("/api/workspaces");
      if (response.ok) {
        const data = await response.json() as Workspace[];

        setWorkspaces((prev) =>
          isSameWorkspaceList(prev, data) ? prev : data
        );

        const matchingWorkspace = slug
          ? data.find((w) => w.slug === slug)
          : undefined;
        const currentId = currentWorkspaceIdRef.current;

        if (currentId) {
          const updatedCurrent = data.find((w) => w.id === currentId);
          if (updatedCurrent) {
            setCurrentWorkspace((prev) =>
              prev && isSameWorkspace(prev, updatedCurrent)
                ? prev
                : updatedCurrent
            );
          }
        } else {
          const nextWorkspace = matchingWorkspace || data[0];
          if (nextWorkspace) {
            setCurrentWorkspace((prev) =>
              prev && isSameWorkspace(prev, nextWorkspace)
                ? prev
                : nextWorkspace
            );
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch workspaces:", error);
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  const switchWorkspace = useCallback(async (workspace: Workspace) => {
    try {
      const response = await apiFetch("/api/workspaces/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: workspace.id }),
      });

      if (response.ok) {
        setCurrentWorkspace(workspace);
      }
    } catch (error) {
      console.error("Failed to switch workspace:", error);
    }
  }, []);

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
          setWorkspaces((prev) => [...prev, workspace]);
          setCurrentWorkspace(workspace);
          return workspace;
        }
      } catch (error) {
        console.error("Failed to create workspace:", error);
      }
      return null;
    },
    []
  );

  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  // 监听外部触发的空间列表刷新（如收到空间权限变更通知时）
  useEffect(() => {
    const handler = () => refreshWorkspaces();
    window.addEventListener("refresh-workspaces", handler);
    return () => window.removeEventListener("refresh-workspaces", handler);
  }, [refreshWorkspaces]);

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspace,
        workspaces,
        isLoading,
        switchWorkspace,
        refreshWorkspaces,
        createWorkspace,
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
