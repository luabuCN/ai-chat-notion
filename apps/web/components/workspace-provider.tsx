"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useParams } from "next/navigation";
import type { Workspace } from "./workspace-switcher";

interface WorkspaceContextValue {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  isLoading: boolean;
  switchWorkspace: (workspace: Workspace) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (name: string, icon?: string) => Promise<Workspace | null>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const slug = params?.slug as string | undefined;
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(
    null
  );
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      const response = await fetch("/api/workspaces");
      if (response.ok) {
        const data = await response.json();

        // 如果用户没有任何空间，自动创建一个默认空间
        if (data.length === 0) {
          const createResponse = await fetch("/api/workspaces", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "我的空间" }),
          });

          if (createResponse.ok) {
            const newWorkspace = await createResponse.json();
            setWorkspaces([newWorkspace]);
            setCurrentWorkspace(newWorkspace);
          }
        } else {
          setWorkspaces(data);
          // 如果没有当前空间，选择第一个
          if (!currentWorkspace) {
            const matchingWorkspace = slug
              ? data.find((w: Workspace) => w.slug === slug)
              : undefined;
            setCurrentWorkspace(matchingWorkspace || data[0]);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch workspaces:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace, slug]);

  const switchWorkspace = useCallback(async (workspace: Workspace) => {
    try {
      const response = await fetch("/api/workspaces/switch", {
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
        const response = await fetch("/api/workspaces", {
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
