import { auth } from "@/app/(auth)/auth";
import { getEditorDocumentPath } from "@repo/database";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;
    const path = await getEditorDocumentPath(id);

    return NextResponse.json(path);
  } catch (error) {
    console.error("[DOCUMENT_PATH_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
