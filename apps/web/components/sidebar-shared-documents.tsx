"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, Users, FileIcon } from "lucide-react";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu } from "@repo/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { SidebarDocumentsProvider } from "./sidebar-documents-context";
import Item from "./sidebar-document-item";

interface SharedDocument {
  id: string;
  title: string;
  icon: string | null;
  workspaceId: string | null;
  updatedAt: string;
  lastEditedByName: string | null;
  permission: string;
}

interface SharedDocumentsGroup {
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  documents: SharedDocument[];
}

export function SidebarSharedDocuments() {
  const pathname = usePathname();
  const { currentWorkspace } = useWorkspace();

  const [sharedGroups, setSharedGroups] = useState<SharedDocumentsGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {}
  );

  const fetchSharedDocuments = useCallback(async (silent: boolean) => {
    if (!currentWorkspace?.id) {
      return;
    }

    if (!silent) {
      setLoading(true);
    }
    try {
      const params = new URLSearchParams({ workspaceId: currentWorkspace.id });
      const response = await apiFetch(
        `/api/editor-documents/shared-with-me?${params.toString()}`
      );
      if (response.ok) {
        const data = (await response.json()) as SharedDocumentsGroup[];
        setSharedGroups(data);
        setExpandedGroups((prev) => {
          if (data.length === 0) {
            return prev;
          }
          if (Object.keys(prev).length > 0) {
            return prev;
          }
          return { [data[0].ownerId]: true };
        });
      }
    } catch {
      // 忽略网络错误，保留当前列表
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    if (!currentWorkspace?.id) {
      return;
    }

    void fetchSharedDocuments(false);
  }, [currentWorkspace?.id, fetchSharedDocuments]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && currentWorkspace?.id) {
        void fetchSharedDocuments(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [currentWorkspace?.id, fetchSharedDocuments]);

  const toggleGroup = (ownerId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [ownerId]: !prev[ownerId],
    }));
  };

  if (!currentWorkspace?.id) {
    return null;
  }

  if (loading) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel>
          <Users className="size-4" />
          他人文档
        </SidebarGroupLabel>
        <SidebarMenu>
          <div className="space-y-1 px-2">
            <div className="h-7 bg-muted/50 rounded-md animate-pulse" />
            <div className="h-7 bg-muted/50 rounded-md animate-pulse" />
          </div>
        </SidebarMenu>
      </SidebarGroup>
    );
  }

  if (sharedGroups.length === 0) {
    return null;
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        <Users className="size-4" />
        他人文档
      </SidebarGroupLabel>
      <SidebarDocumentsProvider>
        <SidebarMenu>
          {sharedGroups.map((group) => {
            const isExpanded = expandedGroups[group.ownerId];
            return (
              <div key={group.ownerId}>
                {/* 分组标题 */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.ownerId)}
                  className={cn(
                    "flex items-center gap-1.5 w-full px-2 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
                  )}
                >
                  {isExpanded ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                  <span className="truncate">{group.ownerName}</span>
                  <span className="text-xs text-muted-foreground/70">
                    ({group.documents.length})
                  </span>
                </button>

                {/* 文档列表 */}
                {isExpanded && (
                  <div className="pl-6">
                    {group.documents.map((document) => (
                      <div key={document.id} className="py-0.5">
                        <Item
                          id={document.id}
                          href={`/editor/${document.id}`}
                          label={document.title}
                          icon={FileIcon}
                          active={
                            decodeURIComponent(pathname) ===
                              `/editor/${document.id}` ||
                            pathname === `/editor/${document.id}`
                          }
                          level={1}
                          onExpand={() => {}}
                          expanded={false}
                          documentIcon={document.icon}
                          canEdit={false}
                          lastEditedByName={document.lastEditedByName}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </SidebarMenu>
      </SidebarDocumentsProvider>
    </SidebarGroup>
  );
}
