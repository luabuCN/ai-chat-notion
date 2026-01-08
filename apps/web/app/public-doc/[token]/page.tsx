import { redirect } from "next/navigation";
import { prisma } from "@repo/database";
import { auth } from "@/app/(auth)/auth";

interface PublicDocPageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicDocPage({ params }: PublicDocPageProps) {
  const { token } = await params;
  const session = await auth();

  // 根据 token 查找文档
  const document = await prisma.editorDocument.findFirst({
    where: {
      publicShareToken: token,
      isPublished: true,
      deletedAt: null,
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!document) {
    // 文档不存在或未发布
    redirect("/");
  }

  // 如果用户已登录且不是文档所有者，添加到访问记录
  if (session?.user?.id && session.user.id !== document.userId) {
    try {
      await prisma.documentVisitor.upsert({
        where: {
          documentId_userId: {
            documentId: document.id,
            userId: session.user.id,
          },
        },
        update: {
          visitedAt: new Date(),
        },
        create: {
          documentId: document.id,
          userId: session.user.id,
        },
      });
    } catch (error) {
      console.error("[Public Doc] Failed to record visit:", error);
    }
  }

  // 重定向到文档编辑页面
  redirect(`/editor/${document.id}`);
}
