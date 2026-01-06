import { getAuthFromRequest } from "@/lib/api-auth";
import type { ArtifactKind } from "@/components/artifact";
import {
  deleteDocumentsByIdAfterTimestamp,
  getDocumentsById,
  saveDocument,
  doUsersShareWorkspace,
} from "@repo/database";
import { ChatSDKError } from "@/lib/errors";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError(
      "bad_request:api",
      "Parameter id is missing"
    ).toResponse();
  }

  const { user } = getAuthFromRequest(request);

  if (!user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  const documents = await getDocumentsById({ id });

  const [document] = documents;

  if (!document) {
    return new ChatSDKError("not_found:document").toResponse();
  }

  // Allow if owner OR if users share a workspace
  const isOwner = document.userId === user.id;
  const shareWorkspace = await doUsersShareWorkspace({
    userId1: document.userId,
    userId2: user.id,
  });

  if (!isOwner && !shareWorkspace) {
    return new ChatSDKError("forbidden:document").toResponse();
  }

  return Response.json(documents, { status: 200 });
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError(
      "bad_request:api",
      "Parameter id is required."
    ).toResponse();
  }

  const { user } = getAuthFromRequest(request);

  if (!user) {
    return new ChatSDKError("not_found:document").toResponse();
  }

  const {
    content,
    title,
    kind,
  }: { content: string; title: string; kind: ArtifactKind } =
    await request.json();

  const documents = await getDocumentsById({ id });

  if (documents.length > 0) {
    const [doc] = documents;

    // Allow if owner OR if users share a workspace
    const isOwner = doc.userId === user.id;
    const shareWorkspace = await doUsersShareWorkspace({
      userId1: doc.userId,
      userId2: user.id,
    });

    if (!isOwner && !shareWorkspace) {
      return new ChatSDKError("forbidden:document").toResponse();
    }
  }

  const document = await saveDocument({
    id,
    content,
    title,
    kind,
    userId: user.id,
  });

  return Response.json(document, { status: 200 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const timestamp = searchParams.get("timestamp");

  if (!id) {
    return new ChatSDKError(
      "bad_request:api",
      "Parameter id is required."
    ).toResponse();
  }

  if (!timestamp) {
    return new ChatSDKError(
      "bad_request:api",
      "Parameter timestamp is required."
    ).toResponse();
  }

  const { user } = getAuthFromRequest(request);

  if (!user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  const documents = await getDocumentsById({ id });

  const [document] = documents;

  // Allow if owner OR if users share a workspace
  const isOwner = document.userId === user.id;
  const shareWorkspace = await doUsersShareWorkspace({
    userId1: document.userId,
    userId2: user.id,
  });

  if (!isOwner && !shareWorkspace) {
    return new ChatSDKError("forbidden:document").toResponse();
  }

  const documentsDeleted = await deleteDocumentsByIdAfterTimestamp({
    id,
    timestamp: new Date(timestamp),
  });

  return Response.json(documentsDeleted, { status: 200 });
}
