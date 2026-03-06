import { auth } from "../../../(auth)/auth";
import { redirect } from "next/navigation";
import { requireWorkspaceAccess } from "@/lib/workspace-access";
import { ImageGenerationStudio } from "@/components/image-generation-studio";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const { slug } = await params;
  await requireWorkspaceAccess(slug);

  return <ImageGenerationStudio />;
}
