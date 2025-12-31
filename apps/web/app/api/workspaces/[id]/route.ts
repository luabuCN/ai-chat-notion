import { auth } from "@/app/(auth)/auth";
import { updateWorkspace, deleteWorkspace } from "@repo/database";
import { ChatSDKError } from "@/lib/errors";
import { NextResponse } from "next/server";

// PATCH /api/workspaces/[id] - 更新空间
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const { id } = await params;
    const { name, icon } = await request.json();

    const workspace = await updateWorkspace({
      id,
      name: name?.trim(),
      icon,
    });

    return NextResponse.json(workspace);
  } catch (error) {
    console.error("Failed to update workspace:", error);
    return new ChatSDKError(
      "bad_request:api",
      "Failed to update workspace"
    ).toResponse();
  }
}

// DELETE /api/workspaces/[id] - 删除空间
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const { id } = await params;
    await deleteWorkspace({ id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete workspace:", error);
    return new ChatSDKError(
      "bad_request:api",
      "Failed to delete workspace"
    ).toResponse();
  }
}
