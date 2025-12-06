"use client";

import {
  Folder,
  MoreHorizontal,
  Plus,
  Trash2,
  FileText,
  Pencil,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@repo/ui";

type FileSystemItem = {
  id: string;
  name: string;
  type: "file" | "folder";
  children?: FileSystemItem[];
};

const initialData: FileSystemItem[] = [
  {
    id: "1",
    name: "Nextjs的缓存机制",
    type: "folder",
    children: [
      {
        id: "1-1",
        name: "关于store结构响应式.txt",
        type: "file",
      },
      {
        id: "1-2",
        name: "Server Actions.md",
        type: "file",
      },
    ],
  },
  {
    id: "2",
    name: "React Server Components",
    type: "folder",
    children: [
      {
        id: "2-1",
        name: "Streaming.md",
        type: "file",
      },
    ],
  },
  {
    id: "3",
    name: "Project Ideas.txt",
    type: "file",
  },
];

export function SidebarDocuments() {
  const router = useRouter();

  const handleAddDocument = () => {
    router.push("/editor");
  };

  return (
    <SidebarGroup className="group/documents">
      <SidebarGroupLabel>
        AI 文档
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarGroupAction className="opacity-0 transition-opacity group-hover/documents:opacity-100">
              <Plus />
              <span className="sr-only">Add</span>
            </SidebarGroupAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleAddDocument}>
              <FileText className="mr-2 h-4 w-4" />
              <span>添加文档</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Folder className="mr-2 h-4 w-4" />
              <span>添加文件夹</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarGroupLabel>
      <SidebarMenu>
        {initialData.map((item) => (
          <DocumentTreeItem key={item.id} item={item} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

function DocumentTreeItem({
  item,
  isSubItem = false,
}: {
  item: FileSystemItem;
  isSubItem?: boolean;
}) {
  const router = useRouter();

  const handleAddDocument = () => {
    router.push("/editor");
  };

  const ActionsMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {isSubItem ? (
          <button className="absolute right-1 top-1.5 flex h-5 w-5 items-center justify-center rounded-md text-sidebar-foreground opacity-0 transition-opacity hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-hover/menu-item:opacity-100 focus-visible:opacity-100 focus-visible:ring-2">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">More</span>
          </button>
        ) : (
          <SidebarMenuAction showOnHover>
            <MoreHorizontal />
            <span className="sr-only">More</span>
          </SidebarMenuAction>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right">
        <DropdownMenuItem onClick={handleAddDocument}>
          <FileText className="mr-2 h-4 w-4" />
          <span>添加文档</span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Pencil className="mr-2 h-4 w-4" />
          <span>重命名</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-red-500">
          <Trash2 className="mr-2 h-4 w-4" />
          <span>移到垃圾桶</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const ItemContent = (
    <>
      {item.type === "folder" && (
        <ChevronRight className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
      )}
      {item.type === "folder" ? <Folder /> : <FileText />}
      <span>{item.name}</span>
    </>
  );

  if (item.type === "folder") {
    const Wrapper = isSubItem ? SidebarMenuSubItem : SidebarMenuItem;
    const Button = isSubItem ? SidebarMenuSubButton : SidebarMenuButton;

    return (
      <Collapsible className="group/collapsible" asChild>
        <Wrapper>
          <CollapsibleTrigger asChild>
            <Button tooltip={item.name}>{ItemContent}</Button>
          </CollapsibleTrigger>
          {ActionsMenu}
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.children?.map((child) => (
                <DocumentTreeItem
                  key={child.id}
                  item={child}
                  isSubItem={true}
                />
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </Wrapper>
      </Collapsible>
    );
  }

  // File item
  const Wrapper = isSubItem ? SidebarMenuSubItem : SidebarMenuItem;
  const Button = isSubItem ? SidebarMenuSubButton : SidebarMenuButton;

  return (
    <Wrapper>
      <Button onClick={() => router.push("/editor")} tooltip={item.name}>
        {ItemContent}
      </Button>
      {ActionsMenu}
    </Wrapper>
  );
}
