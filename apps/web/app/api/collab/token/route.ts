import { getAuthFromRequest } from "@/lib/api-auth";
import { ChatSDKError } from "@/lib/errors";
import { verifyDocumentAccess } from "@/lib/document-access";
import jwt from "jsonwebtoken";

/**
 * 生成协同编辑 Token
 * POST /api/collab/token
 * Body: { documentId: string }
 */
export async function POST(request: Request) {
  const { user } = getAuthFromRequest(request);

  if (!user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  try {
    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return new ChatSDKError(
        "bad_request:api",
        "Document ID is required"
      ).toResponse();
    }

    // 验证文档访问权限（包括访客协作者）
    const { access } = await verifyDocumentAccess(documentId, user.id, user.email);

    if (access === "none") {
      return new ChatSDKError("forbidden:document").toResponse();
    }

    // 生成 JWT token
    const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      console.error("Missing AUTH_SECRET or JWT_SECRET");
      return new ChatSDKError(
        "bad_request:api",
        "Server configuration error"
      ).toResponse();
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name || user.email?.split("@")[0] || "Anonymous",
        documentId,
        accessLevel: access,
      },
      secret,
      {
        expiresIn: "24h", // Token 有效期 24 小时
      }
    );

    return Response.json({
      token,
      accessLevel: access,
      expiresIn: 24 * 60 * 60, // 秒
    });
  } catch (error) {
    console.error("Failed to generate collab token:", error);
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to generate collaboration token"
    ).toResponse();
  }
}

