import { z } from "zod";

export const completionRequestSchema = z.object({
  prompt: z.string().optional(),
  messages: z.array(z.unknown()).optional(),
  system: z.string().optional(),
  temperature: z.number().optional().default(0.7),
});

export type CompletionRequest = z.infer<typeof completionRequestSchema>;

export const openaiRequestSchema = z.object({
  messages: z.array(z.unknown()).optional(),
  prompt: z.string().optional(),
  system: z.string().optional(),
  temperature: z.number().optional(),
  model: z.string().optional(),
  stream: z.boolean().optional(),
});

export type OpenaiRequest = z.infer<typeof openaiRequestSchema>;
