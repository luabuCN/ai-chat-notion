import type { Context } from "hono";
import { z } from "zod";
import { getSessionFromRequest } from "../../../shared/auth.js";
import { ApiError } from "../../../shared/errors.js";

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_OTHER_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "text/plain",
  "text/markdown",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/pdf",
] as const;

const MIME_DENY_MESSAGE =
  "File type should be one of: PNG, JPEG, TXT, Markdown (.md), Word (.doc or .docx), PDF (.pdf)";

const sizeRefinement = (file: Blob) =>
  file.size <=
  (file.type === "application/pdf" ? MAX_PDF_BYTES : MAX_OTHER_BYTES);

const sizeRefinementMessage = {
  message:
    "File size exceeds limit (PDF up to 20MB, other files up to 5MB)",
} as const;

function buildUploadSchema(relaxMimeTypes: boolean) {
  const base = z.instanceof(Blob).refine(sizeRefinement, sizeRefinementMessage);

  const fileSchema = relaxMimeTypes
    ? base
    : base.refine(
        (file) =>
          ALLOWED_MIME_TYPES.includes(
            file.type as (typeof ALLOWED_MIME_TYPES)[number]
          ),
        { message: MIME_DENY_MESSAGE }
      );

  return z.object({ file: fileSchema });
}

export async function uploadFileHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:api").toResponse();
  }

  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return c.json({ error: "No file uploaded" }, 400);
    }

    const relaxMimeTypesRaw = formData.get("relaxMimeTypes");
    const relaxMimeTypes =
      relaxMimeTypesRaw === "true" || relaxMimeTypesRaw === "1";

    const validatedFile = buildUploadSchema(relaxMimeTypes).safeParse({
      file,
    });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(", ");
      return c.json({ error: errorMessage }, 400);
    }

    const { UTApi } = await import("uploadthing/server");
    const utapi = new UTApi();

    try {
      const response = await utapi.uploadFiles(file);

      if (response.error) {
        return c.json({ error: response.error.message }, 500);
      }

      const data = response.data;
      return c.json({
        url: data.url,
        pathname: data.name,
        contentType: data.type,
      });
    } catch {
      return c.json({ error: "Upload failed" }, 500);
    }
  } catch {
    return c.json({ error: "Failed to process request" }, 500);
  }
}
