import { getToken } from "next-auth/jwt";
import jwt from "jsonwebtoken";
import { serverConfig, usesSecureSessionCookie } from "./config.js";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  type: string;
  avatarUrl?: string | null;
}

export interface AuthSession {
  user: AuthUser;
}

export interface ApiTokenPayload {
  userId: string;
  email?: string;
  name?: string;
  type?: string;
  iat?: number;
  exp?: number;
}

export function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }
  return authorization.slice("Bearer ".length).trim() || null;
}

function sessionFromApiToken(token: string): AuthSession | null {
  if (!serverConfig.apiAuthSecret) {
    return null;
  }

  try {
    const payload = jwt.verify(token, serverConfig.apiAuthSecret) as ApiTokenPayload;
    if (!payload.userId) {
      return null;
    }

    return {
      user: {
        id: payload.userId,
        email: payload.email || "",
        name: payload.name || payload.email?.split("@")[0] || "Anonymous",
        type: payload.type || "regular",
      },
    };
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(
  request: Request
): Promise<AuthSession | null> {
  const bearerToken = getBearerToken(request);
  if (bearerToken) {
    const bearerSession = sessionFromApiToken(bearerToken);
    if (bearerSession) {
      return bearerSession;
    }
  }

  if (!serverConfig.authSecret) {
    console.error("[Auth] Missing AUTH_SECRET environment variable");
    return null;
  }

  const token = await getToken({
    req: request as any,
    secret: serverConfig.authSecret,
    secureCookie: usesSecureSessionCookie(),
  });

  if (!token) {
    return null;
  }

  const id = (token.id as string | undefined) || token.sub;
  if (!id) {
    return null;
  }

  return {
    user: {
      id,
      email: (token.email as string | null | undefined) || "",
      name:
        (token.name as string | null | undefined) ||
        token.email?.split("@")[0] ||
        "Anonymous",
      type: ((token as any).type as string | undefined) || "regular",
      avatarUrl: ((token as any).avatarUrl as string | null | undefined) || null,
    },
  };
}

export async function requireSession(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return null;
  }
  return session;
}
