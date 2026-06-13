import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  createUser,
  findUserByEmail,
  setSessionCookie,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, name, password } = await req.json();
    if (!email || !password || String(password).length < 6) {
      return NextResponse.json(
        { error: "Email and a password of at least 6 characters are required." },
        { status: 400 }
      );
    }
    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: "An account with that email already exists." },
        { status: 409 }
      );
    }
    const user = await createUser(email, name ?? "", password);
    const token = await createSessionToken(user);
    await setSessionCookie(token);
    return NextResponse.json({ user });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Signup failed" },
      { status: 500 }
    );
  }
}
