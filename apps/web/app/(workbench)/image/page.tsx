import { auth } from "../../(auth)/auth";
import { redirect } from "next/navigation";
import { ImageGenerationStudio } from "@/components/image/image-generation-studio";

export default async function Page() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return <ImageGenerationStudio />;
}
