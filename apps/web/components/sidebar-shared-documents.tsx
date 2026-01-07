"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, Users, FileIcon } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
} from "@repo/ui";
import { cn } from "@/lib/utils";
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
  const router = useRouter();
  const pathname = usePathname();

  const [sharedGroups, setSharedGroups] = useState<SharedDocumentsGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {}
  );

  useEffect(() => {
    const fetchSharedDocuments = async () => {
      try {
        const response = await fetch("/api/editor-documents/shared-with-me");
        if (response.ok) {
          const data = await response.json();
          setSharedGroups(data);
          // 默认展开第一个分组
          if (data.length > 0) {
            setExpandedGroups({ [data[0].ownerId]: true });
          }
        }
      } catch (error) {
        console.error("Failed to fetch shared documents:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSharedDocuments();
  }, []);

  const toggleGroup = (ownerId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [ownerId]: !prev[ownerId],
    }));
  };

  const onRedirect = (documentId: string) => {
    // 他人文档直接跳转到 /editor/[id]，不包含 workspace slug
    router.push(`/editor/${documentId}`);
  };

  if (loading) {
    return null;
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
                    <div
                      key={document.id}
                      className="py-0.5"
                    >
                      <Item
                        id={document.id}
                        onClick={() => onRedirect(document.id)}
                        label={document.title}
                        icon={FileIcon}
                        active={pathname === `/editor/${document.id}`}
                        level={1}
                        onExpand={() => {}}
                        expanded={false}
                        documentIcon={document.icon}
                        canEdit={document.permission === "edit"}
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
    </SidebarGroup>
  );
}

