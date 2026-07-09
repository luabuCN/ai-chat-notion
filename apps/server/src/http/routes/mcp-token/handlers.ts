import type { Context } from "hono";
import crypto from "node:crypto";
import { getSessionFromRequest } from "../../../shared/auth.js";
import { ApiError } from "../../../shared/errors.js";
import {
  getMcpTokenByUserId,
  createMcpToken,
  deleteMcpTokenByUserId,
} from "@repo/database";

function generateToken(): string {
  return `mcp_${crypto.randomBytes(16).toString("hex")}`;
}

/** GET /api/mcp-token — 获取当前用户的 token 状态（不返回明文/哈希） */
export async function getMcpTokenHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:api").toResponse();
  }

  const tokenRecord = await getMcpTokenByUserId(session.user.id);
  if (!tokenRecord) {
    return c.json({ hasToken: false, createdAt: null }, 200);
  }

  return c.json(
    {
      hasToken: true,
      createdAt: tokenRecord.createdAt,
    },
    200,
  );
}

/** POST /api/mcp-token — 生成/重新生成 token（明文仅此一次返回） */
export async function createMcpTokenHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:api").toResponse();
  }

  const token = generateToken();
  const tokenRecord = await createMcpToken(session.user.id, token);

  return c.json(
    {
      token,
      createdAt: tokenRecord.createdAt,
    },
    201,
  );
}

/** DELETE /api/mcp-token — 吊销 token */
export async function deleteMcpTokenHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:api").toResponse();
  }

  await deleteMcpTokenByUserId(session.user.id);

  return c.json({ success: true }, 200);
}
