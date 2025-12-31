import { auth } from "../(auth)/auth";
import {
  getWorkspacesByUserId,
  createWorkspace,
  generateWorkspaceSlug,
} from "@repo/database";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default async function Page() {
  const session = await auth();

  if (!session?.user) {
    // 未登录显示欢迎页面
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-linear-to-b from-background to-muted/30">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            欢迎使用 AI Chat
          </h1>
          <p className="mt-2 text-muted-foreground">智能对话，让创意更简单</p>
        </div>
        <a
          href="/login"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          登录开始使用
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    );
  }

  // 获取用户的空间列表
  let workspaces = await getWorkspacesByUserId({ userId: session.user.id });

  // 如果没有空间，创建默认空间
  if (workspaces.length === 0) {
    const slug = generateWorkspaceSlug();
    await createWorkspace({
      name: "我的空间",
      slug,
      ownerId: session.user.id,
    });
    workspaces = await getWorkspacesByUserId({ userId: session.user.id });
  }

  const defaultWorkspace = workspaces[0];

  // 已登录显示欢迎页面
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-linear-to-b from-background to-muted/30">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          欢迎回来，{session.user.name || session.user.email}
        </h1>
        <p className="mt-2 text-muted-foreground">智能对话，让创意更简单</p>
      </div>
      <Link
        href={`/${defaultWorkspace.slug}/chat`}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
      >
        进入我的空间
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
