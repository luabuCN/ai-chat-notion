"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useDocumentPath } from "@/hooks/use-document-query";

interface SidebarDocumentsContextType {
  expanded: Record<string, boolean>;
  onExpand: (id: string) => void;
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const pathname = usePathname();

  // Extract document ID from pathname
  // 匹配 /[slug]/editor/[id] 格式的路径
  const match = pathname?.match(/\/[^\/]+\/editor\/([^\/]+)/);
  const currentDocumentId = match ? match[1] : null;

  // Fetch ancestor path
  const { data: path } = useDocumentPath(currentDocumentId);

  // Auto-expand when path changes
  useEffect(() => {
    if (path && path.length > 0) {
      setExpanded((prev) => {
        const next = { ...prev };
        let hasChanges = false;

        path.forEach((id) => {
          if (!next[id]) {
            next[id] = true;
            hasChanges = true;
          }
        });

        return hasChanges ? next : prev;
      });
    }
  }, [path]);

  const onExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <SidebarDocumentsContext.Provider value={{ expanded, onExpand }}>
      {children}
    </SidebarDocumentsContext.Provider>
  );
}
