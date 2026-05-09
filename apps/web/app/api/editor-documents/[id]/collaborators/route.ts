import { getAuthFromRequest } from "@/lib/api-auth";
import { verifyDocumentAccess } from "@/lib/document-access";
import { ChatSDKError } from "@/lib/errors";
import {
  assertDocumentCanManage,
  isPermissionChangedError,
  permissionChangedResponse,
} from "@/lib/permission-assert";
import { prisma } from "@repo/database";
import crypto from "node:crypto";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = getAuthFromRequest(request);
  const { id: documentId } = await params;

  if (!user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  try {
    const { access } = await verifyDocumentAccess(
      documentId,
      user.id,
      user.email
    );

    if (access !== "owner" && access !== "edit") {
      return new ChatSDKError("forbidden:document").toResponse();
    }

    const collaborators = await prisma.documentCollaborator.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(collaborators, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to get collaborators"
    ).toResponse();
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = getAuthFromRequest(request);
  const { id: documentId } = await params;

  if (!user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  try {
    await assertDocumentCanManage(documentId, user);

    const { email, permission = "edit" } = (await request.json()) as {
      email?: string;
      permission?: "view" | "edit";
    };

    if (!email) {
      return new ChatSDKError(
        "bad_request:api",
        "Email is required"
      ).toResponse();
    }

    const existing = await prisma.documentCollaborator.findUnique({
      where: {
        documentId_email: {
          documentId,
          email,
        },
      },
    });

    if (existing) {
      return new ChatSDKError(
        "bad_request:api",
        "This user has already been invited"
      ).toResponse();
    }

    const invitedUser = await prisma.user.findFirst({
      where: { email },
    });

    const token = crypto.randomBytes(32).toString("hex");

    const collaborator = await prisma.documentCollaborator.create({
      data: {
        documentId,
        email,
        userId: invitedUser?.id,
        permission,
        status: "pending",
        invitedBy: user.id,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        acceptedAt: null,
      },
    });

    return Response.json(collaborator, { status: 201 });
  } catch (error) {
    if (isPermissionChangedError(error)) {
      return permissionChangedResponse(error.message);
    }
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to invite collaborator"
    ).toResponse();
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = getAuthFromRequest(request);
  const { id: documentId } = await params;

  if (!user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  try {
    await assertDocumentCanManage(documentId, user);

    const { email, permission } = (await request.json()) as {
      email?: string;
      permission?: "view" | "edit";
    };

    if (!email || !permission || !["view", "edit"].includes(permission)) {
      return new ChatSDKError(
        "bad_request:api",
        "Email and permission are required"
      ).toResponse();
    }

    const collaborator = await prisma.documentCollaborator.update({
      where: {
        documentId_email: {
          documentId,
          email,
        },
      },
      data: { permission },
    });

    return Response.json(collaborator, { status: 200 });
  } catch (error) {
    if (isPermissionChangedError(error)) {
      return permissionChangedResponse(error.message);
    }
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to update collaborator"
    ).toResponse();
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = getAuthFromRequest(request);
  const { id: documentId } = await params;
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  if (!email) {
    return new ChatSDKError(
      "bad_request:api",
      "Email is required"
    ).toResponse();
  }

  try {
    await assertDocumentCanManage(documentId, user);

    await prisma.documentCollaborator.delete({
      where: {
        documentId_email: {
          documentId,
          email,
        },
      },
    });

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    if (isPermissionChangedError(error)) {
      return permissionChangedResponse(error.message);
    }
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to remove collaborator"
    ).toResponse();
  }
}
