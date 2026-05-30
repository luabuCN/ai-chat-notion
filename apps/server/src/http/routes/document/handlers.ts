import type { Context } from "hono";
import type { ArtifactKind } from "../../../shared/types.js";
import {
  deleteDocumentsByIdAfterTimestamp,
  getDocumentsById,
  saveDocument,
  doUsersShareWorkspace,
} from "@repo/database";
import { getSessionFromRequest } from "../../../shared/auth.js";
import { ApiError } from "../../../shared/errors.js";

export async function getDocumentHandler(c: Context) {
  const searchParams = new URL(c.req.url).searchParams;
  const id = searchParams.get("id");

  if (!id) {
    return new ApiError(
      "bad_request:api",
      "Parameter id is missing"
    ).toResponse();
  }

  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:document").toResponse();
  }

  const documents = await getDocumentsById({ id });

  const [document] = documents;
  if (!document) {
    return new ApiError("not_found:document").toResponse();
  }

  // Allow if owner OR if users share a workspace
  const isOwner = document.userId === session.user.id;
  const shareWorkspace = await doUsersShareWorkspace({
    userId1: document.userId,
    userId2: session.user.id,
  });

  if (!isOwner && !shareWorkspace) {
    return new ApiError("forbidden:document").toResponse();
  }

  return c.json(documents, 200);
}

export async function postDocumentHandler(c: Context) {
  const searchParams = new URL(c.req.url).searchParams;
  const id = searchParams.get("id");

  if (!id) {
    return new ApiError(
      "bad_request:api",
      "Parameter id is required."
    ).toResponse();
  }

  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("not_found:document").toResponse();
  }

  const {
    content,
    title,
    kind,
  }: { content: string; title: string; kind: ArtifactKind } =
    await c.req.json();

  const documents = await getDocumentsById({ id });

  if (documents.length > 0) {
    const [doc] = documents;

    // Allow if owner OR if users share a workspace
    const isOwner = doc.userId === session.user.id;
    const shareWorkspace = await doUsersShareWorkspace({
      userId1: doc.userId,
      userId2: session.user.id,
    });

    if (!isOwner && !shareWorkspace) {
      return new ApiError("forbidden:document").toResponse();
    }
  }

  const document = await saveDocument({
    id,
    content,
    title,
    kind,
    userId: session.user.id,
  });

  return c.json(document, 200);
}

export async function deleteDocumentHandler(c: Context) {
  const searchParams = new URL(c.req.url).searchParams;
  const id = searchParams.get("id");
  const timestamp = searchParams.get("timestamp");

  if (!id) {
    return new ApiError(
      "bad_request:api",
      "Parameter id is required."
    ).toResponse();
  }

  if (!timestamp) {
    return new ApiError(
      "bad_request:api",
      "Parameter timestamp is required."
    ).toResponse();
  }

  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:document").toResponse();
  }

  const documents = await getDocumentsById({ id });

  const [document] = documents;

  // Allow if owner OR if users share a workspace
  const isOwner = document.userId === session.user.id;
  const shareWorkspace = await doUsersShareWorkspace({
    userId1: document.userId,
    userId2: session.user.id,
  });

  if (!isOwner && !shareWorkspace) {
    return new ApiError("forbidden:document").toResponse();
  }

  const documentsDeleted = await deleteDocumentsByIdAfterTimestamp({
    id,
    timestamp: new Date(timestamp),
  });

  return c.json(documentsDeleted, 200);
}
