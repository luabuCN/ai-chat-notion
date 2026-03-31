import { auth } from "@/app/(auth)/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  return NextResponse.json({
    authenticated: Boolean(session),
    user: session?.user ?? null,
  });
}
