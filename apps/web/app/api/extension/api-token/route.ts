import { auth } from "@/app/(auth)/auth";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export const dynamic = "force-dynamic";

const API_TOKEN_TTL_SECONDS = 15 * 60;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = process.env.API_AUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 },
    );
  }

  const token = jwt.sign(
    {
      userId: session.user.id,
      email: session.user.email ?? undefined,
      name: session.user.name ?? undefined,
      type: (session.user as any).type ?? "regular",
    },
    secret,
    { expiresIn: API_TOKEN_TTL_SECONDS },
  );

  return NextResponse.json({
    token,
    expiresIn: API_TOKEN_TTL_SECONDS,
  });
}
