import { auth } from "@/app/(auth)/auth";
import { prisma } from "@repo/database";
import { redirect } from "next/navigation";
import { JoinButton } from "./join-button";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const session = await auth();
  const { code } = await params;

  if (!session?.user) {
    redirect(`/login?callbackUrl=/invite/${code}`);
  }

  // 1. Try to find specific invite
  const specificInvite = await prisma.workspaceInvite.findUnique({
    where: { token: code },
    include: {
      workspace: {
        include: {
          owner: true,
          _count: {
            select: { members: true },
          },
        },
      },
    },
  });

  let workspace: any = null;

  if (specificInvite) {
    if (new Date() > specificInvite.expiresAt) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
          <h1 className="text-2xl font-bold">邀请链接已过期</h1>
          <p className="text-muted-foreground">请联系管理员重新发送邀请。</p>
        </div>
      );
    }
    workspace = {
      ...specificInvite.workspace,
      email: specificInvite.email,
      role: specificInvite.role,
      permission: specificInvite.permission,
    };
  } else {
    // 2. Try generic workspace invite
    workspace = await prisma.workspace.findUnique({
      where: { inviteCode: code },
      include: {
        owner: true,
        _count: {
          select: { members: true },
        },
      },
    });
  }

  if (!workspace) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">无效的邀请链接</h1>
        <p className="text-muted-foreground">该邀请链接不存在或已过期。</p>
      </div>
    );
  }

  // Check if already a member
  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: session.user.id,
      },
    },
  });

  if (member) {
    redirect(`/${workspace.slug}/chat`);
  }

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-background">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-16 items-center justify-center rounded-xl bg-primary text-3xl font-bold text-primary-foreground">
          {workspace.icon || workspace.name.charAt(0)}
        </div>
        <h1 className="text-2xl font-bold">邀请您加入 {workspace.name}</h1>
        <p className="text-muted-foreground">
          由 {workspace.owner.email} 邀请 • {workspace._count.members} 位成员
        </p>

        {/* 特定邀请信息 */}
        {/* 特定邀请信息 */}
        {workspace.email && (
          <div className="mt-4 p-4 bg-muted/50 rounded-lg text-sm text-left w-full max-w-sm border">
            <p>
              <span className="font-semibold">受邀人：</span> {workspace.email}
            </p>
            <p>
              <span className="font-semibold">角色：</span>{" "}
              {workspace.role === "admin" ? "管理员" : "成员"}
            </p>
            <p>
              <span className="font-semibold">权限：</span>{" "}
              {workspace.permission === "edit" ? "可修改" : "可查看"}
            </p>

            {session.user.email &&
              workspace.email &&
              session.user.email !== workspace.email && (
                <div className="mt-2 text-yellow-600 bg-yellow-50 p-2 rounded border border-yellow-200">
                  注意：您当前登录账号为 <b>{session.user.email}</b>
                  ，与受邀人邮箱不符。请确认您是否使用了正确的账户。
                </div>
              )}
          </div>
        )}
      </div>
      {/* 只有邮箱匹配或没有邮箱限制时才显示加入按钮 */}
      {(!workspace.email || session.user.email === workspace.email) && (
        <JoinButton code={code} />
      )}
      {workspace.email && session.user.email !== workspace.email && (
        <p className="text-sm text-muted-foreground">
          请使用 <b>{workspace.email}</b> 账户登录后加入
        </p>
      )}
    </div>
  );
}
