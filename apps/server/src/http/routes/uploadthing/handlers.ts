import type { Context } from "hono";
import { createUploadthing } from "uploadthing/next";
import { makeAdapterHandler } from "uploadthing/server";
import { Effect } from "effect";

const f = createUploadthing();

const editorUploader = f(["image", "text", "blob", "pdf", "video", "audio"])
  .middleware(() => ({
    experimental_UTRegion: "auto" as const,
  }))
  .onUploadComplete(({ file }) => ({
    key: file.key,
    name: file.name,
    size: file.size,
    type: file.type,
    url: file.ufsUrl,
  }));

const ourFileRouter = { editorUploader };

const handler = makeAdapterHandler(
  (req: Request) => Effect.succeed({ req }),
  (req: Request) => Effect.succeed(req),
  { router: ourFileRouter },
  "hono"
);

export async function uploadthingHandler(c: Context) {
  return handler(c.req.raw);
}
