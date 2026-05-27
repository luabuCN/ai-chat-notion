import { z } from "zod";

export const collabTokenBodySchema = z.object({
  documentId: z.string().min(1),
});

export type CollabTokenBody = z.infer<typeof collabTokenBodySchema>;
