/**
 * API 认证辅助函数
 * 从中间件注入的请求头中读取用户信息，避免重复调用 auth()
 */

export interface AuthUser {
  id: string;
  email: string;
  type: string;
}

export interface AuthResult {
  user: AuthUser | null;
}

/**
 * 从请求头获取用户信息（由中间件注入）
 * 用于替代 API 路由中的 `await auth()`
 *
 * @example
 * ```ts
 * export async function GET(request: Request) {
 *   const { user } = getAuthFromRequest(request);
 *   if (!user) {
 *     return new ChatSDKError("unauthorized:chat").toResponse();
 *   }
 *   // 使用 user.id, user.email 等
 * }
 * ```
 */
export function getAuthFromRequest(request: Request): AuthResult {
  const userId = request.headers.get("x-user-id");
  const userEmail = request.headers.get("x-user-email");
  const userType = request.headers.get("x-user-type");

  if (!userId) {
    return { user: null };
  }

  return {
    user: {
      id: userId,
      email: userEmail || "",
      type: userType || "regular",
    },
  };
}

/**
 * 验证用户是否已登录
 * 返回用户信息或抛出错误响应
 */
export function requireAuth(request: Request): AuthUser {
  const { user } = getAuthFromRequest(request);
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
