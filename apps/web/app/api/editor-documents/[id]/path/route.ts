import { getAuthFromRequest } from "@/lib/api-auth";
import { getEditorDocumentPath } from "@repo/database";
import { NextResponse } from "next/server";
import { verifyDocumentAccess } from "@/lib/document-access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = getAuthFromRequest(request);

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  try {
    // 验证文档访问权限 - 查看权限即可获取路径
    const { access } = await verifyDocumentAccess(id, user.id);

    if (access === "none") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const path = await getEditorDocumentPath(id);

    return NextResponse.json(path);
  } catch (error) {
    console.error("[DOCUMENT_PATH_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
