"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import {
  ChevronDown,
  Plus,
  Settings,
  UserPlus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Link as LinkIcon,
  Copy,
  RefreshCw,
  Check,
} from "lucide-react";
import { WorkspaceSettingsDialog } from "./workspace-settings-dialog";

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  ownerId: string;
  _count: { members: number };
  members?: { role: string; permission: string }[];
};

interface WorkspaceSwitcherProps {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  userId: string;
  onSwitch?: (workspace: Workspace) => void;
  onSettingsClick?: (workspace: Workspace) => void;
  onInviteClick?: (workspace: Workspace) => void;
  onRefresh?: () => Promise<void>;
}

export function WorkspaceSwitcher({
  currentWorkspace,
  workspaces,
  userId,
  onSwitch,
  onSettingsClick,
  onRefresh,
}: WorkspaceSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  // 创建空间状态
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // 邀请状态
  const [inviteLink, setInviteLink] = useState("");
  const [isLoadingLink, setIsLoadingLink] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // 邀请表单数据
  const [inviteeEmail, setInviteeEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [invitePermission, setInvitePermission] = useState("view");

  const generateInviteLink = async () => {
    if (!currentWorkspace || !inviteeEmail.trim()) return;
    setIsLoadingLink(true);
    try {
      const res = await fetch(`/api/workspaces/${currentWorkspace.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteeEmail,
          role: inviteRole,
          permission: invitePermission,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          setInviteLink(`${window.location.origin}/invite/${data.token}`);
        }
      }
    } catch (error) {
      console.error("Failed to generate invite link:", error);
    } finally {
      setIsLoadingLink(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // 权限联动逻辑
  const handleRoleChange = (role: string) => {
    setInviteRole(role);
    if (role === "admin") {
      setInvitePermission("edit"); // 管理员必须是可修改
    } else {
      setInvitePermission("view"); // 用户默认为查看，但可改为修改
    }
  };

  const handlePermissionChange = (permission: string) => {
    setInvitePermission(permission);
  };

  const resetInviteForm = () => {
    setInviteLink("");
    setInviteeEmail("");
    setInviteRole("member");
    setInvitePermission("view");
  };

  // 重命名状态
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [workspaceToRename, setWorkspaceToRename] = useState<Workspace | null>(
    null
  );
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  // 删除状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newWorkspaceName.trim() }),
      });

      if (response.ok) {
        const workspace = await response.json();
        setCreateDialogOpen(false);
        setNewWorkspaceName("");
        router.push(`/${workspace.slug}/chat`);
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to create workspace:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSwitchWorkspace = async (workspace: Workspace) => {
    try {
      await fetch("/api/workspaces/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: workspace.id }),
      });

      setOpen(false);
      onSwitch?.(workspace);
      router.push(`/${workspace.slug}/chat`);
      router.refresh();
    } catch (error) {
      console.error("Failed to switch workspace:", error);
    }
  };

  const handleRenameWorkspace = async () => {
    if (!workspaceToRename || !renameValue.trim()) return;

    setIsRenaming(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceToRename.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });

      if (response.ok) {
        setRenameDialogOpen(false);
        setWorkspaceToRename(null);
        setRenameValue("");
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to rename workspace:", error);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!workspaceToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setDeleteDialogOpen(false);
        setWorkspaceToDelete(null);
        // 如果删除的是当前空间，跳转到第一个其他空间
        if (currentWorkspace?.id === workspaceToDelete.id) {
          const otherWorkspace = workspaces.find(
            (w) => w.id !== workspaceToDelete.id
          );
          if (otherWorkspace) {
            router.push(`/${otherWorkspace.slug}/chat`);
          } else {
            router.push("/");
          }
        }
        await onRefresh?.();
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to delete workspace:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const openRenameDialog = (workspace: Workspace, e: React.MouseEvent) => {
    e.stopPropagation();
    setWorkspaceToRename(workspace);
    setRenameValue(workspace.name);
    setRenameDialogOpen(true);
    setOpen(false);
  };

  const openDeleteDialog = (workspace: Workspace, e: React.MouseEvent) => {
    e.stopPropagation();
    setWorkspaceToDelete(workspace);
    setDeleteDialogOpen(true);
    setOpen(false);
  };

  const isDefaultWorkspace = (workspace: Workspace) => {
    return workspace.name === "我的空间";
  };

  const displayName = currentWorkspace?.name || "选择空间";
  const memberCount = currentWorkspace?._count?.members || 1;
  const displayIcon =
    currentWorkspace?.icon || currentWorkspace?.name?.charAt(0) || "W";

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted transition-colors">
            <div className="flex size-6 items-center justify-center rounded-sm bg-primary text-primary-foreground text-xs font-semibold">
              {displayIcon}
            </div>
            <div className="flex-1 truncate">
              <span className="font-medium">{displayName}</span>
            </div>
            <ChevronDown className="size-4 opacity-50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {/* 当前空间信息 */}
          {currentWorkspace && (
            <>
              <div className="px-2 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-sm bg-primary text-primary-foreground font-semibold">
                    {displayIcon}
                  </div>
                  <div>
                    <div className="font-medium">{currentWorkspace.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {memberCount} 名成员
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  {(currentWorkspace.ownerId === userId ||
                    currentWorkspace.members?.some(
                      (m) => m.role === "admin"
                    )) && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setOpen(false);
                          setSettingsDialogOpen(true);
                        }}
                      >
                        <Settings className="size-3.5 mr-1" />
                        设置
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setOpen(false);
                          setInviteDialogOpen(true);
                          resetInviteForm();
                        }}
                      >
                        <UserPlus className="size-3.5 mr-1" />
                        邀请成员
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <DropdownMenuSeparator />
            </>
          )}

          {/* 空间列表 */}
          {(() => {
            const myWorkspaces = workspaces.filter((w) => w.ownerId === userId);
            const joinedWorkspaces = workspaces.filter(
              (w) => w.ownerId !== userId
            );

            return (
              <>
                {myWorkspaces.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs text-muted-foreground mt-2 first:mt-0">
                      我的空间
                    </div>
                    {myWorkspaces.map((workspace) => {
                      const isActive = currentWorkspace?.id === workspace.id;
                      const isDefault = isDefaultWorkspace(workspace);

                      return (
                        <div
                          key={workspace.id}
                          className={`flex items-center gap-1 mx-1 rounded-md ${
                            isActive
                              ? "bg-primary/10 border border-primary/30"
                              : "hover:bg-muted"
                          }`}
                        >
                          {/* 三点菜单 */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="p-1.5 hover:bg-muted rounded-md opacity-60 hover:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="size-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-32">
                              <DropdownMenuItem
                                onClick={(e) => openRenameDialog(workspace, e)}
                              >
                                <Pencil className="size-4 mr-2" />
                                重命名
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => openDeleteDialog(workspace, e)}
                                disabled={isDefault}
                                className={
                                  isDefault
                                    ? "text-muted-foreground cursor-not-allowed"
                                    : "text-destructive focus:text-destructive"
                                }
                              >
                                <Trash2 className="size-4 mr-2" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          {/* 空间信息 */}
                          <button
                            className="flex flex-1 items-center gap-2 py-1.5 pr-2 cursor-pointer"
                            onClick={() => handleSwitchWorkspace(workspace)}
                          >
                            <div className="flex size-5 items-center justify-center rounded-sm bg-muted text-xs font-medium">
                              {workspace.icon || workspace.name.charAt(0)}
                            </div>
                            <span className={isActive ? "font-medium" : ""}>
                              {workspace.name}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}

                {joinedWorkspaces.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs text-muted-foreground mt-2">
                      加入的空间
                    </div>
                    {joinedWorkspaces.map((workspace) => {
                      const isActive = currentWorkspace?.id === workspace.id;

                      return (
                        <div
                          key={workspace.id}
                          className={`flex items-center gap-1 mx-1 rounded-md ${
                            isActive
                              ? "bg-primary/10 border border-primary/30"
                              : "hover:bg-muted"
                          }`}
                        >
                          {/* 空间信息 - 占满宽度 */}
                          <button
                            className="flex flex-1 items-center gap-2 py-1.5 px-2 cursor-pointer"
                            onClick={() => handleSwitchWorkspace(workspace)}
                          >
                            <div className="flex size-5 items-center justify-center rounded-sm bg-muted text-xs font-medium">
                              {workspace.icon || workspace.name.charAt(0)}
                            </div>
                            <span className={isActive ? "font-medium" : ""}>
                              {workspace.name}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}
              </>
            );
          })()}

          <DropdownMenuSeparator />

          {/* 创建空间 */}
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => {
              setOpen(false);
              setCreateDialogOpen(true);
            }}
          >
            <Plus className="size-4 mr-2" />
            创建空间
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 创建空间对话框 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>创建空间</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="workspace-name">空间名称</Label>
              <Input
                id="workspace-name"
                placeholder="输入空间名称"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateWorkspace();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              onClick={handleCreateWorkspace}
              disabled={isCreating || !newWorkspaceName.trim()}
            >
              {isCreating ? "创建中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 邀请成员对话框 */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>邀请成员</DialogTitle>
            <DialogDescription>
              生成一个特定的邀请链接。只有拥有此链接的人才能加入。
            </DialogDescription>
          </DialogHeader>

          {!inviteLink ? (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="invitee-email">受邀人邮箱</Label>
                <Input
                  id="invitee-email"
                  placeholder="输入对方的邮箱"
                  value={inviteeEmail}
                  onChange={(e) => setInviteeEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  用于核对加入者的身份
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="invite-role">角色</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(value) => handleRoleChange(value)}
                  >
                    <SelectTrigger id="invite-role" className="h-9">
                      <SelectValue placeholder="选择角色" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">用户</SelectItem>
                      <SelectItem value="admin">管理员</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="invite-permission">权限</Label>
                  <Select
                    value={invitePermission}
                    onValueChange={(value) => handlePermissionChange(value)}
                    disabled={inviteRole === "admin"}
                  >
                    <SelectTrigger id="invite-permission" className="h-9">
                      <SelectValue placeholder="选择权限" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">可查看</SelectItem>
                      <SelectItem value="edit">可修改</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={generateInviteLink}
                disabled={!inviteeEmail.trim() || isLoadingLink}
                className="mt-2"
              >
                {isLoadingLink ? "生成中..." : "生成并复制链接"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4 py-4">
              <div className="flex items-center space-x-2">
                <div className="grid flex-1 gap-2">
                  <Label htmlFor="link" className="sr-only">
                    Link
                  </Label>
                  <Input
                    id="link"
                    value={inviteLink}
                    readOnly
                    className="h-9"
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  className="px-3"
                  onClick={copyToClipboard}
                >
                  {isCopied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  <span className="sr-only">Copy</span>
                </Button>
              </div>
              <div className="text-center">
                <Button
                  variant="link"
                  size="sm"
                  onClick={resetInviteForm}
                  className="text-muted-foreground"
                >
                  创建另一个邀请
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 重命名对话框 */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>重命名空间</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="rename-workspace">新名称</Label>
              <Input
                id="rename-workspace"
                placeholder="输入新的空间名称"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameWorkspace();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              type="submit"
              onClick={handleRenameWorkspace}
              disabled={isRenaming || !renameValue.trim()}
            >
              {isRenaming ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除空间</DialogTitle>
            <DialogDescription>
              确定要删除「{workspaceToDelete?.name}
              」吗？此操作无法撤销，空间内的所有内容将被永久删除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteWorkspace}
              disabled={isDeleting}
            >
              {isDeleting ? "删除中..." : "删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 设置对话框 */}
      <WorkspaceSettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        workspace={currentWorkspace}
        currentUserId={userId}
      />
    </>
  );
}
