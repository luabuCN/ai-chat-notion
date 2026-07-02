"use client";

import { resolveUserAvatarUrl } from "@repo/database/dicebear-avatar";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Avatar,
  AvatarFallback,
  AvatarImage,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Workspace } from "./workspace-switcher";
import { EmojiPicker } from "./editor/emoji-picker";
import { useWorkspace } from "./workspace-provider";
import { apiFetch } from "@/lib/api-client";

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
  const { applyWorkspaceUpdate } = useWorkspace();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceIcon, setWorkspaceIcon] = useState<string | null>(null);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);

  const isOwner = workspace?.ownerId === currentUserId;
  const currentUserRole = members.find((m) => m.userId === currentUserId)?.role;
  const isAdmin = currentUserRole === "admin";
  const canEditWorkspace = isOwner || isAdmin;
  const hasGeneralChanges =
    !!workspace &&
    (workspaceName.trim() !== workspace.name ||
      workspaceIcon !== workspace.icon);
  const displayIcon =
    workspaceIcon || workspaceName.charAt(0) || workspace?.name.charAt(0) || "W";

  const fetchMembers = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const response = await apiFetch(
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

  useEffect(() => {
    if (open && workspace) {
      setWorkspaceName(workspace.name);
      setWorkspaceIcon(workspace.icon);
      setIsEditingName(false);
    }
  }, [open, workspace?.id, workspace?.name, workspace?.icon]);

  useEffect(() => {
    if (isEditingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [isEditingName]);

  const handleSaveGeneralSettings = async () => {
    if (!workspace || !workspaceName.trim()) return;

    setSavingGeneral(true);
    try {
      const response = await apiFetch(`/api/workspaces/${workspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workspaceName.trim(),
          icon: workspaceIcon,
        }),
      });

      if (response.ok) {
        const updated = (await response.json()) as {
          name: string;
          icon: string | null;
          slug: string;
        };
        applyWorkspaceUpdate(workspace.id, {
          name: updated.name,
          icon: updated.icon,
          slug: updated.slug,
        });
        setIsEditingName(false);
        toast.success("空间信息已更新");
      } else {
        const error = await response.json().catch(() => null);
        toast.error(error?.message || "更新空间信息失败");
      }
    } catch (error) {
      console.error("Failed to update workspace:", error);
      toast.error("更新空间信息失败");
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleCancelNameEdit = () => {
    if (workspace) {
      setWorkspaceName(workspace.name);
    }
    setIsEditingName(false);
  };

  const handleUpdateMember = async (
    userId: string,
    field: "role" | "permission",
    value: string
  ) => {
    if (!workspace) return;
    setUpdating(userId);
    try {
      const response = await apiFetch("/api/workspaces/members", {
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
      } else {
        const error = await response.json().catch(() => null);
        toast.error(error?.message || "更新成员失败");
      }
    } catch (error) {
      console.error("Failed to update member:", error);
      toast.error("更新成员失败");
    } finally {
      setUpdating(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!workspace) return;
    setUpdating(userId);
    try {
      const response = await apiFetch(
        `/api/workspaces/members?workspaceId=${workspace.id}&userId=${userId}`,
        { method: "DELETE" }
      );
      if (response.ok) {
        setMembers((prev) => prev.filter((m) => m.userId !== userId));
        toast.success("成员已移除");
      } else {
        const error = await response.json().catch(() => null);
        toast.error(error?.message || "移除成员失败");
      }
    } catch (error) {
      console.error("Failed to remove member:", error);
      toast.error("移除成员失败");
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

  const getMemberPermissionLabel = (member: Member): string => {
    if (member.userId === workspace?.ownerId || member.role === "admin") {
      return "可修改";
    }

    return getPermissionLabel(member.permission);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>空间设置</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 pb-2">
          {canEditWorkspace ? (
            <EmojiPicker onEmojiSelect={setWorkspaceIcon}>
              <button
                type="button"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-highlight text-xl transition-colors hover:bg-highlight/80"
                title="更换图标"
              >
                {displayIcon}
              </button>
            </EmojiPicker>
          ) : (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-highlight text-xl">
              {displayIcon}
            </div>
          )}

          <div className="min-w-0 flex-1">
            {canEditWorkspace && isEditingName ? (
              <Input
                ref={nameInputRef}
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                disabled={savingGeneral}
                className="h-9 border-0 border-b border-primary rounded-none bg-transparent px-1 shadow-none focus-visible:ring-0"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && hasGeneralChanges) {
                    void handleSaveGeneralSettings();
                  }
                  if (e.key === "Escape") {
                    handleCancelNameEdit();
                  }
                }}
                onBlur={() => {
                  if (!hasGeneralChanges) {
                    setIsEditingName(false);
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className={`w-full truncate text-left text-base font-medium ${
                  canEditWorkspace
                    ? "rounded-md px-1.5 py-1 hover:bg-muted/60"
                    : "cursor-default px-1.5 py-1"
                }`}
                onClick={() => {
                  if (canEditWorkspace) {
                    setIsEditingName(true);
                  }
                }}
                disabled={!canEditWorkspace}
              >
                {workspaceName || workspace?.name}
              </button>
            )}
          </div>

          {canEditWorkspace && hasGeneralChanges ? (
            <Button
              type="button"
              size="sm"
              className="h-8 shrink-0 px-3"
              onClick={() => void handleSaveGeneralSettings()}
              disabled={!workspaceName.trim() || savingGeneral}
            >
              {savingGeneral ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "保存"
              )}
            </Button>
          ) : null}
        </div>

        <div className="mt-2">
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
                    <th className="text-left font-medium p-3 w-32">角色</th>
                    <th className="text-left font-medium p-3 w-32">权限</th>
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
                                src={resolveUserAvatarUrl({
                                  avatarUrl: member.user.avatarUrl,
                                  name: member.user.name,
                                  email: member.user.email,
                                  id: member.userId,
                                })}
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
                                <SelectItem value="admin">管理员</SelectItem>
                                <SelectItem value="member">成员</SelectItem>
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
                          member.role === "member" ? (
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
                                <SelectItem value="edit">可修改</SelectItem>
                                <SelectItem value="view">可查看</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-muted-foreground">
                              {getMemberPermissionLabel(member)}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {canEdit &&
                            !isMemberOwner &&
                            member.userId !== currentUserId && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    disabled={isUpdatingThis}
                                  >
                                    {isUpdatingThis ? (
                                      <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="size-4" />
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>移除成员</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      确定要将「
                                      {member.user.name ||
                                        member.user.email ||
                                        "该成员"}
                                      」移出此空间吗？移除后该成员将无法访问空间内的文档。
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>取消</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() =>
                                        void handleRemoveMember(member.userId)
                                      }
                                    >
                                      移除
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
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
