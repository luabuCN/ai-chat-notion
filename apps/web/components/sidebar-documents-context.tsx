"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useDocumentPath } from "@/hooks/use-document-query";

interface SidebarDocumentsContextType {
  expanded: Record<string, boolean>;
  onExpand: (id: string) => void;
  /** 强制展开指定节点（不 toggle），用于创建子文档后保证父级可见 */
  setExpanded: (id: string) => void;
}

const SidebarDocumentsContext = createContext<
  SidebarDocumentsContextType | undefined
>(undefined);

export function useSidebarDocumentsContext() {
  const context = useContext(SidebarDocumentsContext);
  if (!context) {
    throw new Error(
      "useSidebarDocumentsContext must be used within a SidebarDocumentsProvider"
    );
  }
  return context;
}

export function SidebarDocumentsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const pathname = usePathname();

  // 匹配 /[slug]/editor/[id] 格式的路径
  const match = pathname?.match(/\/[^\/]+\/editor\/([^\/]+)/);
  const currentDocumentId = match ? match[1] : null;

  const { data: path } = useDocumentPath(currentDocumentId);

  // 路径变化时自动展开祖先节点
  useEffect(() => {
    if (path && path.length > 0) {
      setExpandedMap((prev) => {
        const next = { ...prev };
        let hasChanges = false;

        for (const id of path) {
          if (!next[id]) {
            next[id] = true;
            hasChanges = true;
          }
        }

        return hasChanges ? next : prev;
      });
    }
  }, [path]);

  const onExpand = (id: string) => {
    setExpandedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const setExpandedById = (id: string) => {
    setExpandedMap((prev) =>
      prev[id] ? prev : { ...prev, [id]: true }
    );
  };

  return (
    <SidebarDocumentsContext.Provider
      value={{
        expanded: expandedMap,
        onExpand,
        setExpanded: setExpandedById,
      }}
    >
      {children}
    </SidebarDocumentsContext.Provider>
  );
}
