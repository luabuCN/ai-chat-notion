import { z } from "zod";

/** 与 seedMessages 中单条 text 上限一致；扩展「总结网页」等需在单条 user 消息中附带长正文 */
const MAX_CHAT_TEXT_PART_LENGTH = 100_000;

const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1).max(MAX_CHAT_TEXT_PART_LENGTH),
});

const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.enum([
    "image/jpeg",
    "image/png",
    "text/plain",
    "text/markdown",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/pdf",
  ]),
  name: z.string().min(1).max(100),
  url: z.string().url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid(),
    role: z.enum(["user"]),
    parts: z.array(partSchema),
  }),
  selectedModelSlug: z.string().optional(),
  enableReasoning: z.boolean().optional(),
  modelCapabilities: z
    .object({
      supports_image_in: z.boolean().optional(),
      supports_video_in: z.boolean().optional(),
      supports_reasoning: z.boolean().optional(),
    })
    .optional(),
  workspaceSlug: z.string().optional(),
  documentIds: z.array(z.string().uuid()).optional(),
  /**
   * 扩展侧栏：划词「继续聊天」时首轮对话仅在客户端，需随第一次 POST 一并入库，
   * 否则服务端 `getMessagesByChatId` 为空，后续轮次无上下文。
   */
  seedMessages: z
    .array(
      z.object({
        id: z.string().uuid(),
        role: z.enum(["user", "assistant"]),
        parts: z
          .array(
            z.object({
              type: z.literal("text"),
              text: z.string().min(1).max(MAX_CHAT_TEXT_PART_LENGTH),
            }),
          )
          .min(1),
      }),
    )
    .max(20)
    .optional(),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
