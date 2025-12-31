import { requireWorkspaceAccess } from "@/lib/workspace-access";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // 验证用户对该空间的访问权限
  await requireWorkspaceAccess(slug);

  // 如果没有文档 ID，显示空状态
  return (
    <div className="relative h-screen flex-1 flex flex-col bg-background">
      <div className="flex-1 overflow-auto">
        <div className="min-h-full flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p className="text-lg mb-2">选择一个文档开始编辑</p>
            <p className="text-sm">或从侧边栏创建新文档</p>
          </div>
        </div>
      </div>
    </div>
  );
}
