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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Workspace } from "./workspace-switcher";
import { apiFetch } from "@/lib/api-client";

export const workspaceKeys = {
  all: ["workspaces"] as const,
};

interface WorkspaceContextValue {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  isLoading: boolean;
  switchWorkspace: (workspace: Workspace) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (name: string, icon?: string) => Promise<Workspace | null>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

async function fetchWorkspaces(): Promise<Workspace[]> {
  const response = await apiFetch("/api/workspaces");
  if (!response.ok) {
    throw new Error("Failed to fetch workspaces");
  }
  return response.json();
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const slug = params?.slug as string | undefined;
  const queryClient = useQueryClient();
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(
    null
  );
  const currentWorkspaceRef = useRef<Workspace | null>(null);

  const {
    data: workspaces = [],
    isLoading,
    refetch,
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
    if (workspaces.length > 0 && slug) {
      const workspace = workspaces.find((w) => w.slug === slug);
      if (workspace && workspace.id !== currentWorkspace?.id) {
        setCurrentWorkspace(workspace);
      }
    }
  }, [slug, workspaces, currentWorkspace]);

  // Pick default workspace once list is available
  useEffect(() => {
    if (workspaces.length === 0 || currentWorkspaceRef.current) {
      return;
    }

    const matchingWorkspace = slug
      ? workspaces.find((w) => w.slug === slug)
      : undefined;
    setCurrentWorkspace(matchingWorkspace || workspaces[0]);
  }, [slug, workspaces]);

  const refreshWorkspaces = useCallback(async () => {
    await refetch();
  }, [refetch]);

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
          queryClient.setQueryData<Workspace[]>(workspaceKeys.all, (prev) =>
            prev ? [...prev, workspace] : [workspace]
          );
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
      void refetch();
    };
    window.addEventListener("refresh-workspaces", handler);
    return () => window.removeEventListener("refresh-workspaces", handler);
  }, [refetch]);

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
