import { Toaster } from "sonner";
export default async function Page() {
  // 如果没有文档 ID，重定向到创建新文档或显示空状态
  // 这里可以显示一个欢迎页面或自动创建新文档
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
      <Toaster />
    </div>
  );
}
