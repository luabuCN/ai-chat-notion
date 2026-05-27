/**
 * 扩展侧栏（chrome-extension:// / moz-extension://）跨域访问主站 API 时的 CORS。
 *
 * 注意：第一批已迁移到 apps/server 的接口（chat / history / models / collab / ai）
 * 现在由 Hono 统一处理 CORS，不再需要这里的 helper。仅剩下尚未迁移到 apps/server
 * 的第二/三批接口（workspaces、editor-documents 等）继续使用此模块。
 */
function isExtensionOrigin(origin: string | null): boolean {
  if (!origin) {
    return false;
  }
  return (
    origin.startsWith("chrome-extension://") ||
    origin.startsWith("moz-extension://")
  );
}

export function withExtensionCors(request: Request, response: Response): Response {
  const origin = request.headers.get("origin");
  if (!isExtensionOrigin(origin) || !origin) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** OPTIONS 预检；非扩展来源返回 null，由调用方回退默认 204 */
export function extensionCorsOptionsResponse(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (!isExtensionOrigin(origin) || !origin) {
    return null;
  }
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Cookie",
      "Access-Control-Max-Age": "86400",
    },
  });
}
