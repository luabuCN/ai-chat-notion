"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Avatar,
  AvatarFallback,
  Input,
} from "@repo/ui";
import {
  Users,
  UserPlus,
  Trash2,
  Loader2,
  Copy,
  Check,
  Link2,
  Globe,
  GlobeLock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePublicEditDocument } from "@/hooks/use-document-query";
import { useCollaboration } from "./collaboration-context";

interface Collaborator {
  id: string;
  email: string;
  userId: string | null;
  permission: "view" | "edit";
  status: "pending" | "accepted" | "rejected";
  token: string;
  createdAt: string;
}

interface WorkspaceMember {
  id: string;
  userId: string;
  role: string;
  permission: string;
  user: {
    id: string;
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
  };
}

interface DocumentSharePopoverProps {
  documentId: string;
  workspaceId: string | null;
  /** 公开协作模式：匿名用户可通过链接协同编辑 */
  isPubliclyEditable: boolean;
  isOwner: boolean;
  currentUserId?: string;
  documentOwnerId?: string; // 文档创建者ID
  hasCollaborators?: boolean; // 是否有协作者（用于高亮显示）
  publicShareToken?: string | null; // 公开协作链接 token
}

type TabType = "members" | "guests";

export function DocumentSharePopover({
  documentId,
  workspaceId,
  isPubliclyEditable,
  isOwner,
  currentUserId,
  documentOwnerId,
  hasCollaborators = false,
  publicShareToken,
}: DocumentSharePopoverProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("members");
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>(
    []
  );
  const [documentOwner, setDocumentOwner] = useState<{
    id: string;
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePermission, setInvitePermission] = useState<"view" | "edit">(
    "edit"
  );
  const [inviting, setInviting] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedInviteToken, setCopiedInviteToken] = useState<string | null>(
    null
  );
  const [publishing, setPublishing] = useState(false);
  const publicEditMutation = usePublicEditDocument();
  const { connectedUsers } = useCollaboration();

  // 获取协作者列表
  const fetchCollaborators = useCallback(async () => {
    if (!documentId) return;
    try {
      const response = await fetch(
        `/api/editor-documents/${documentId}/collaborators`
      );
      if (response.ok) {
        const data = await response.json();
        setCollaborators(data);
      }
    } catch (error) {
      console.error("Failed to fetch collaborators:", error);
    }
  }, [documentId]);

  // 获取工作空间成员列表
  const fetchWorkspaceMembers = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const response = await fetch(
        `/api/workspaces/members?workspaceId=${workspaceId}`
      );
      if (response.ok) {
        const data = await response.json();
        setWorkspaceMembers(data);
      }
    } catch (error) {
      console.error("Failed to fetch workspace members:", error);
    }
  }, [workspaceId]);

  // 获取文档创建者信息
  const fetchDocumentOwner = useCallback(async () => {
    if (!documentOwnerId) return;
    try {
      const response = await fetch(`/api/users/${documentOwnerId}`);
      if (response.ok) {
        const data = await response.json();
        setDocumentOwner(data);
      }
    } catch (error) {
      console.error("Failed to fetch document owner:", error);
    }
  }, [documentOwnerId]);

  useEffect(() => {
    if (open) {
      setLoading(true);
      Promise.all([
        fetchCollaborators(),
        fetchWorkspaceMembers(),
        fetchDocumentOwner(),
      ]).finally(() => setLoading(false));
    }
  }, [open, fetchCollaborators, fetchWorkspaceMembers, fetchDocumentOwner]);

  // 检查当前用户是否是空间管理员
  const currentUserMember = workspaceMembers.find(
    (m) => m.userId === currentUserId
  );
  const isWorkspaceAdmin = currentUserMember?.role === "admin";

  // 可以邀请的条件：文档所有者 或 空间管理员
  const canInvite = isOwner || isWorkspaceAdmin;

  // 邀请协作者
  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error("请输入邮箱地址");
      return;
    }

    // 简单的邮箱验证
    if (!inviteEmail.includes("@")) {
      toast.error("请输入有效的邮箱地址");
      return;
    }

    setInviting(true);
    try {
      const response = await fetch(
        `/api/editor-documents/${documentId}/collaborators`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: inviteEmail.trim(),
            permission: invitePermission,
          }),
        }
      );

      if (response.ok) {
        const newCollaborator = await response.json();
        setCollaborators((prev) => [newCollaborator, ...prev]);
        setInviteEmail("");

        // 生成邀请链接
        const inviteLink = `${window.location.origin}/doc-invite/${newCollaborator.token}`;

        // 尝试复制到剪贴板
        try {
          await navigator.clipboard.writeText(inviteLink);
          toast.success("邀请链接已复制到剪贴板", {
            description: "请将链接发送给被邀请者",
            duration: 4000,
          });
        } catch {
          toast.success("邀请已创建", {
            description: `邀请链接：${inviteLink}`,
            duration: 5000,
          });
        }
      } else {
        const error = await response.json();
        toast.error(error.message || "邀请失败");
      }
    } catch (error) {
      toast.error("邀请失败，请重试");
    } finally {
      setInviting(false);
    }
  };

  // 更新协作者权限
  const handleUpdatePermission = async (
    email: string,
    permission: "view" | "edit"
  ) => {
    setUpdating(email);
    try {
      // 先删除再重新邀请（简化实现）
      await fetch(
        `/api/editor-documents/${documentId}/collaborators?email=${encodeURIComponent(
          email
        )}`,
        { method: "DELETE" }
      );

      const response = await fetch(
        `/api/editor-documents/${documentId}/collaborators`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, permission }),
        }
      );

      if (response.ok) {
        setCollaborators((prev) =>
          prev.map((c) => (c.email === email ? { ...c, permission } : c))
        );
        toast.success("权限已更新");
      }
    } catch (error) {
      toast.error("更新失败");
    } finally {
      setUpdating(null);
    }
  };

  // 移除协作者
  const handleRemoveCollaborator = async (email: string) => {
    setUpdating(email);
    try {
      const response = await fetch(
        `/api/editor-documents/${documentId}/collaborators?email=${encodeURIComponent(
          email
        )}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        setCollaborators((prev) => prev.filter((c) => c.email !== email));
        toast.success("已移除协作者");
      } else {
        toast.error("移除失败");
      }
    } catch (error) {
      toast.error("移除失败");
    } finally {
      setUpdating(null);
    }
  };

  // 切换公开协作状态
  const handleTogglePublish = () => {
    if (!canInvite) {
      toast.error("只有文档创建者或空间管理员可以管理公开协作");
      return;
    }

    setPublishing(true);
    publicEditMutation.mutate(
      { documentId, enable: !isPubliclyEditable },
      {
        onSuccess: () => {
          setPublishing(false);
          toast.success(
            isPubliclyEditable ? "已关闭公开协作" : "已开启公开协作"
          );
        },
        onError: () => {
          setPublishing(false);
          toast.error(
            isPubliclyEditable ? "关闭公开协作失败" : "开启公开协作失败"
          );
        },
      }
    );
  };

  // 复制邀请链接
  const handleCopyInviteLink = (token: string) => {
    const inviteLink = `${window.location.origin}/doc-invite/${token}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedInviteToken(token);
    setTimeout(() => setCopiedInviteToken(null), 2000);
    toast.success("邀请链接已复制");
  };

  // 复制文档链接
  const handleCopyLink = () => {
    let url: string;
    if (isPubliclyEditable && publicShareToken) {
      url = `${window.location.origin}/public-doc/${publicShareToken}`;
    } else {
      url = `${window.location.origin}/editor/${documentId}`;
    }
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("链接已复制");
  };

  // 获取状态标签
  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="text-xs text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 px-1.5 py-0.5 rounded">
            待接受
          </span>
        );
      case "accepted":
        return (
          <span className="text-xs text-green-600 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
            已接受
          </span>
        );
      case "rejected":
        return (
          <span className="text-xs text-red-600 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded">
            已拒绝
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={isPubliclyEditable || hasCollaborators ? "default" : "ghost"}
          size="sm"
          className={cn(
            "h-8 gap-1.5",
            isPubliclyEditable || hasCollaborators
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "text-muted-foreground"
          )}
        >
          <Users className="size-4" />
          <span className="text-xs hidden sm:inline">分享</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[400px] p-0"
        align="end"
        alignOffset={8}
        sideOffset={8}
      >
        {/* Tabs */}
        <div className="flex border-b">
          <button
            type="button"
            className={cn(
              "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === "members"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab("members")}
          >
            成员
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === "guests"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab("guests")}
          >
            访客与公众
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeTab === "members" ? (
            /* 成员 Tab */
            <div className="space-y-3">
              {isPubliclyEditable ? (
                /* 公开模式：显示在线用户 */
                <>
                  {/* 公开编辑提示 */}
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-3">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <Globe className="size-4" />
                      <span className="text-sm font-medium">公开编辑模式</span>
                    </div>
                    <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                      任何人都可以通过链接编辑此文档
                    </p>
                  </div>

                  {/* 在线用户列表 */}
                  {connectedUsers.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground mb-2">
                        当前在线 ({connectedUsers.length} 人)
                      </div>
                      {connectedUsers.map((user, index) => (
                        <div
                          key={`${user.name}-${index}`}
                          className="flex items-center justify-between py-2"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar
                              className="size-8"
                              style={{ backgroundColor: user.color }}
                            >
                              <AvatarFallback
                                className="text-xs text-white"
                                style={{ backgroundColor: user.color }}
                              >
                                {user.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                {user.name}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="size-2 rounded-full bg-green-500" />
                                <span className="text-xs text-muted-foreground">
                                  在线
                                </span>
                              </div>
                            </div>
                          </div>
                          <span className="text-xs text-green-600 dark:text-green-400">
                            编辑
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      暂无用户在线
                    </div>
                  )}
                </>
              ) : workspaceId ? (
                /* 非公开模式：显示工作空间成员 */
                <>
                  {/* 文档创建者（始终显示在最前面） */}
                  {documentOwner && (
                    <div className="space-y-2 border-b pb-3 mb-3">
                      <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {(
                                documentOwner.name ||
                                documentOwner.email ||
                                "?"
                              )
                                .charAt(0)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {documentOwner.name || "未命名"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {documentOwner.email}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-medium text-primary">
                          所有者
                        </span>
                      </div>
                    </div>
                  )}

                  {/* 工作空间成员 */}
                  {workspaceMembers.length > 0 ? (
                    <div className="space-y-2">
                      {workspaceMembers
                        .filter((member) => member.userId !== documentOwnerId) // 排除文档创建者，避免重复显示
                        .map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between py-2"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="size-8">
                                <AvatarFallback className="text-xs">
                                  {(
                                    member.user.name ||
                                    member.user.email ||
                                    "?"
                                  )
                                    .charAt(0)
                                    .toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">
                                  {member.user.name || "未命名"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {member.user.email}
                                </span>
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {member.permission === "edit" ? "编辑" : "查看"}
                            </span>
                          </div>
                        ))}
                    </div>
                  ) : documentOwner ? null : (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      此工作空间暂无其他成员
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  {documentOwner
                    ? "此文档不属于任何工作空间"
                    : "此文档不属于任何工作空间"}
                </div>
              )}
            </div>
          ) : (
            /* 访客与公众 Tab */
            <div className="space-y-4">
              {/* 邀请协作者 - 只在非公开状态下显示 */}
              {!isPubliclyEditable && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">访客协作者</span>
                    {canInvite && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => {
                          const input =
                            document.querySelector<HTMLInputElement>(
                              "#invite-email-input"
                            );
                          input?.focus();
                        }}
                      >
                        <UserPlus className="size-3.5" />
                        添加访客
                      </Button>
                    )}
                  </div>

                  {canInvite ? (
                    <div className="flex gap-2">
                      <Input
                        id="invite-email-input"
                        type="email"
                        placeholder="输入邮箱地址..."
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="h-9 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleInvite();
                          }
                        }}
                      />
                      <Select
                        value={invitePermission}
                        onValueChange={(v) =>
                          setInvitePermission(v as "view" | "edit")
                        }
                      >
                        <SelectTrigger className="w-24 h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="edit">编辑</SelectItem>
                          <SelectItem value="view">查看</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        className="h-9"
                        onClick={handleInvite}
                        disabled={inviting || !inviteEmail.trim()}
                      >
                        {inviting ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          "邀请"
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 text-center">
                      只有文档创建者或空间管理员可以邀请协作者
                    </div>
                  )}
                </div>
              )}

              {/* 公开状态提示 */}
              {isPubliclyEditable && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <Globe className="size-4" />
                    <span className="text-sm font-medium">公开编辑模式</span>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                    任何人都可以通过链接编辑此文档，无需邀请
                  </p>
                </div>
              )}

              {/* 协作者列表 - 只在非公开状态下显示 */}
              {!isPubliclyEditable && collaborators.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  {collaborators.map((collaborator) => (
                    <div
                      key={collaborator.id}
                      className="flex items-center justify-between py-2"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8 bg-primary/10">
                          <AvatarFallback className="text-xs text-primary">
                            {collaborator.email.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {collaborator.email}
                            </span>
                            {getStatusLabel(collaborator.status)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {collaborator.status === "pending" && canInvite && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              handleCopyInviteLink(collaborator.token)
                            }
                            title="复制邀请链接"
                          >
                            {copiedInviteToken === collaborator.token ? (
                              <Check className="size-3.5 text-green-500" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </Button>
                        )}
                        {canInvite && (
                          <>
                            <Select
                              value={collaborator.permission}
                              onValueChange={(v) =>
                                handleUpdatePermission(
                                  collaborator.email,
                                  v as "view" | "edit"
                                )
                              }
                              disabled={updating === collaborator.email}
                            >
                              <SelectTrigger className="w-20 h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="edit">编辑</SelectItem>
                                <SelectItem value="view">查看</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                handleRemoveCollaborator(collaborator.email)
                              }
                              disabled={updating === collaborator.email}
                            >
                              {updating === collaborator.email ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="size-3.5" />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 公开协作 */}
              <div className="border-t pt-3">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    {isPubliclyEditable ? (
                      <Globe className="size-4 text-green-500" />
                    ) : (
                      <GlobeLock className="size-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">公开协作</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleTogglePublish}
                    disabled={publishing || !canInvite}
                    className={cn(
                      "w-10 h-5 rounded-full transition-colors relative",
                      isPubliclyEditable ? "bg-green-500" : "bg-muted",
                      canInvite &&
                        !publishing &&
                        "cursor-pointer hover:opacity-80",
                      (!canInvite || publishing) &&
                        "opacity-50 cursor-not-allowed"
                    )}
                    title={
                      !canInvite
                        ? "只有文档创建者或空间管理员可以管理公开协作"
                        : isPubliclyEditable
                        ? "点击关闭公开协作"
                        : "点击开启公开协作"
                    }
                  >
                    {publishing ? (
                      <Loader2 className="absolute inset-0 size-3 m-auto animate-spin text-white" />
                    ) : (
                      <div
                        className={cn(
                          "absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform",
                          isPubliclyEditable ? "translate-x-5" : "translate-x-0.5"
                        )}
                      />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {isPubliclyEditable
                    ? "任何人都可以通过链接协作编辑此文档"
                    : "仅受邀协作者可以编辑此文档"}
                </p>
              </div>

              {/* 复制链接 */}
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                {copied ? (
                  <Check className="size-4 text-green-500" />
                ) : (
                  <Link2 className="size-4" />
                )}
                复制页面访问链接
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
