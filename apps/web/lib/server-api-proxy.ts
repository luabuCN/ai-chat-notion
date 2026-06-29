import { resolveServerProxyOrigin } from "./server-proxy-origin";

function getServerOrigin(): string {
  return resolveServerProxyOrigin();
}

function applyStreamingHeaders(headers: Headers): void {
  const contentType = headers.get("content-type") ?? "";
  const isEventStream = contentType.includes("text/event-stream");
  const isPlainStream = contentType.includes("text/plain");

  if (!isEventStream && !isPlainStream) {
    return;
  }

  headers.set("Cache-Control", "no-cache, no-transform");
  headers.set("Connection", "keep-alive");
  headers.set("X-Accel-Buffering", "no");
}

/**
 * Proxy API requests to the Hono server without buffering streaming bodies.
 * Next.js rewrites buffer SSE; Route Handlers that pass through upstream.body do not.
 */
export async function proxyToServerApi(
  request: Request,
  apiPath: string
): Promise<Response> {
  const serverOrigin = getServerOrigin();
  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(apiPath, serverOrigin);
  targetUrl.search = incomingUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");

  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  const upstream = await fetch(targetUrl, init);
  const responseHeaders = new Headers(upstream.headers);
  applyStreamingHeaders(responseHeaders);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export async function proxyToServerApiWithPath(
  request: Request,
  prefix: string,
  pathSegments: string[] | undefined
): Promise<Response> {
  const suffix = pathSegments?.length ? `/${pathSegments.join("/")}` : "";
  return proxyToServerApi(request, `${prefix}${suffix}`);
}
