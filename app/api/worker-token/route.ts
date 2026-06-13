import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { getCurrentUser } from "@/lib/auth";

// Mints a short-lived token the browser passes to the streaming worker over the
// WebSocket. The worker verifies it with the shared AUTH_SECRET.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
  const token = await new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);

  return NextResponse.json({
    token,
    workerUrl: process.env.WORKER_PUBLIC_URL || "http://localhost:4000",
  });
}
