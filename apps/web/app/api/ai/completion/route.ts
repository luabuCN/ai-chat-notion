import { proxyToServerApi } from "@/lib/server-api-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return proxyToServerApi(request, "/api/ai/completion");
}

export async function GET(request: Request) {
  return proxyToServerApi(request, "/api/ai/completion");
}
