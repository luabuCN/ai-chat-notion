"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui";
import { Trash2, Loader2 } from "lucide-react";
import type { Workspace } from "./workspace-switcher";

interface Member {
  id: string;
  userId: string;
  role: string;
  permission: string;
  joinedAt: string;
  user: {
    id: string;
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
  };
}

interface WorkspaceSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace | null;
  currentUserId: string;
}

export function WorkspaceSettingsDialog({
  open,
  onOpenChange,
  workspace,
  currentUserId,
}: WorkspaceSettingsDialogProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const isOwner = workspace?.ownerId === currentUserId;
  const currentUserRole = members.find((m) => m.userId === currentUserId)?.role;
  const isAdmin = currentUserRole === "admin";

  const fetchMembers = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces/members?workspaceId=${workspace.id}`
      );
      if (response.ok) {
        const data = await response.json();
        setMembers(data);
      }
    } catch (error) {
      console.error("Failed to fetch members:", error);
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    if (open && workspace) {
      fetchMembers();
    }
  }, [open, workspace, fetchMembers]);

  const handleUpdateMember = async (
    userId: string,
    field: "role" | "permission",
    value: string
  ) => {
    if (!workspace) return;
    setUpdating(userId);
    try {
      const response = await fetch("/api/workspaces/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: workspace.id,
          userId,
          [field]: value,
        }),
      });
      if (response.ok) {
        const updatedMember = await response.json();
        setMembers((prev) =>
          prev.map((m) => (m.userId === userId ? updatedMember : m))
        );
      }
    } catch (error) {
      console.error("Failed to update member:", error);
    } finally {
      setUpdating(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!workspace) return;
    if (!confirm("确定要移除此成员吗？")) return;
    setUpdating(userId);
    try {
      const response = await fetch(
        `/api/workspaces/members?workspaceId=${workspace.id}&userId=${userId}`,
        { method: "DELETE" }
      );
      if (response.ok) {
        setMembers((prev) => prev.filter((m) => m.userId !== userId));
      }
    } catch (error) {
      console.error("Failed to remove member:", error);
    } finally {
      setUpdating(null);
    }
  };

  const canEditMember = (member: Member): boolean => {
    // 所有者可以编辑所有人（除了自己的角色）
    if (isOwner) {
      return member.userId !== workspace?.ownerId;
    }
    // 管理员只能编辑普通成员
    if (isAdmin) {
      return member.role === "member" && member.userId !== workspace?.ownerId;
    }
    return false;
  };

  const getRoleLabel = (member: Member): string => {
    if (member.userId === workspace?.ownerId) return "空间所有者";
    if (member.role === "admin") return "管理员";
    return "成员";
  };

  const getPermissionLabel = (permission: string): string => {
    return permission === "edit" ? "可修改" : "可查看";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>空间设置 - {workspace?.name}</DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          <h3 className="text-sm font-medium mb-3">成员 ({members.length})</h3>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b">
                    <th className="text-left font-medium p-3">用户</th>
                    <th className="text-left font-medium p-3 w-32">权限</th>
                    <th className="text-left font-medium p-3 w-32">角色</th>
                    <th className="p-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => {
                    const canEdit = canEditMember(member);
                    const isMemberOwner = member.userId === workspace?.ownerId;
                    const isUpdatingThis = updating === member.userId;

                    return (
                      <tr
                        key={member.userId}
                        className="border-b last:border-0"
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8">
                              <AvatarImage
                                src={member.user.avatarUrl || undefined}
                              />
                              <AvatarFallback>
                                {(member.user.name || member.user.email || "?")
                                  .charAt(0)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {member.user.name || "未命名"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {member.user.email}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          {canEdit && !isMemberOwner ? (
                            <Select
                              value={member.permission}
                              onValueChange={(value) =>
                                handleUpdateMember(
                                  member.userId,
                                  "permission",
                                  value
                                )
                              }
                              disabled={isUpdatingThis}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="view">可查看</SelectItem>
                                <SelectItem value="edit">可修改</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-muted-foreground">
                              {getPermissionLabel(member.permission)}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {canEdit && !isMemberOwner && isOwner ? (
                            <Select
                              value={member.role}
                              onValueChange={(value) =>
                                handleUpdateMember(member.userId, "role", value)
                              }
                              disabled={isUpdatingThis}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="member">成员</SelectItem>
                                <SelectItem value="admin">管理员</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-muted-foreground">
                              {getRoleLabel(member)}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {canEdit &&
                            !isMemberOwner &&
                            member.userId !== currentUserId && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() =>
                                  handleRemoveMember(member.userId)
                                }
                                disabled={isUpdatingThis}
                              >
                                {isUpdatingThis ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Trash2 className="size-4" />
                                )}
                              </Button>
                            )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
