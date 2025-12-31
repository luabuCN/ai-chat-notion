import { EditorHeaderWrapper } from "@/components/editor/editor-header-wrapper";
import { EditorContent } from "@/components/editor/editor-content";
import { getUserLocale } from "@/i18n/service";
import { requireWorkspaceAccess } from "@/lib/workspace-access";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;

  // 验证用户对该空间的访问权限
  await requireWorkspaceAccess(slug);

  const locale = await getUserLocale();

  return (
    <div className="flex h-dvh min-w-0 flex-col bg-background overflow-hidden">
      <div className="flex-1 overflow-auto min-h-0">
        <div className="sticky top-0 z-49 bg-background shrink-0">
          <EditorHeaderWrapper locale={locale} documentId={id} />
        </div>
        <EditorContent locale={locale} documentId={id} />
      </div>
    </div>
  );
}
