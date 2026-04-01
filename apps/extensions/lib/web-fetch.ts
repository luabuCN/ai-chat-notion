/**
 * 侧栏跨域请求主站 API：`credentials: "include"` 由浏览器按目标源附带 Cookie（需配合主站 CORS
 * `Access-Control-Allow-Credentials`）。不再手拼 `Cookie` 头，避免与真实会话不一致。
 */
export async function webFetchWithMainSiteCookies(
  input: string | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = typeof input === "string" ? input : input.href;
  const headers = new Headers(init?.headers);
  return fetch(url, { ...init, credentials: "include", headers });
}

export async function webFetchJsonErrorBody(res: Response): Promise<{
  code?: string;
  message?: string;
  cause?: string;
}> {
  try {
    return (await res.json()) as {
      code?: string;
      message?: string;
      cause?: string;
    };
  } catch {
    return {};
  }
}
