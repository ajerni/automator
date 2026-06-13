import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  findUserByEmail,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }
    const row = await findUserByEmail(email);
    if (!row || !(await verifyPassword(password, row.password_hash))) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }
    const user = { id: row.id, email: row.email, name: row.name };
    const token = await createSessionToken(user);
    await setSessionCookie(token);
    return NextResponse.json({ user });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Login failed" },
      { status: 500 }
    );
  }
}
