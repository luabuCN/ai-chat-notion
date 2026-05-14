import { requireWorkspaceAccess } from "@/lib/workspace-access";
import { AllDocumentsPage } from "@/components/all-documents-page";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // 验证用户对该空间的访问权限
  await requireWorkspaceAccess(slug);

  return <AllDocumentsPage />;
}
