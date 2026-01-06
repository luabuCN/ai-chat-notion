import { getAuthFromRequest } from "@/lib/api-auth";
import {
  createWorkspace,
  getWorkspacesByUserId,
  getWorkspaceBySlug,
  updateWorkspace,
  deleteWorkspace,
  generateWorkspaceSlug,
  updateUserCurrentWorkspace,
} from "@repo/database";
import { ChatSDKError } from "@/lib/errors";
import { NextResponse } from "next/server";

// GET /api/workspaces - 获取当前用户的所有空间
export async function GET(request: Request) {
  const { user } = getAuthFromRequest(request);

  if (!user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const workspaces = await getWorkspacesByUserId({ userId: user.id });
    return NextResponse.json(workspaces);
  } catch (error) {
    console.error("Failed to get workspaces:", error);
    return new ChatSDKError(
      "bad_request:api",
      "Failed to get workspaces"
    ).toResponse();
  }
}

// POST /api/workspaces - 创建新空间
export async function POST(request: Request) {
  const { user } = getAuthFromRequest(request);

  if (!user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const { name, icon } = await request.json();

    if (!name || typeof name !== "string") {
      return new ChatSDKError(
        "bad_request:api",
        "Name is required"
      ).toResponse();
    }

    // 生成唯一的 slug
    let slug = generateWorkspaceSlug();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await getWorkspaceBySlug({ slug });
      if (!existing) break;
      slug = generateWorkspaceSlug();
      attempts++;
    }

    const workspace = await createWorkspace({
      name: name.trim(),
      slug,
      icon,
      ownerId: user.id,
    });

    // 设置为当前工作空间
    await updateUserCurrentWorkspace({
      userId: user.id,
      workspaceId: workspace.id,
    });

    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    console.error("Failed to create workspace:", error);
    return new ChatSDKError(
      "bad_request:api",
      "Failed to create workspace"
    ).toResponse();
  }
}

// PATCH /api/workspaces - 更新空间
export async function PATCH(request: Request) {
  const { user } = getAuthFromRequest(request);

  if (!user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const { id, name, icon } = await request.json();

    if (!id) {
      return new ChatSDKError(
        "bad_request:api",
        "Workspace ID is required"
      ).toResponse();
    }

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

// DELETE /api/workspaces?id=xxx - 删除空间
export async function DELETE(request: Request) {
  const { user } = getAuthFromRequest(request);

  if (!user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return new ChatSDKError(
        "bad_request:api",
        "Workspace ID is required"
      ).toResponse();
    }

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
