import { proxyToServerApiWithPath } from "@/lib/server-api-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ path?: string[] }> };

async function handle(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return proxyToServerApiWithPath(request, "/api/ai", path);
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
export const PATCH = handle;
export const PUT = handle;
