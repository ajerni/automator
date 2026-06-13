import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { query } from "./db";
import type { SessionUser } from "./types";

const COOKIE_NAME = "automator_session";
const DAY = 60 * 60 * 24;

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifySessionToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      id: String(payload.sub),
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * DAY,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function findUserByEmail(email: string) {
  const rows = await query<{
    id: string;
    email: string;
    name: string;
    password_hash: string;
  }>(
    "SELECT id, email, name, password_hash FROM automator_users WHERE email = $1",
    [email.toLowerCase()]
  );
  return rows[0] ?? null;
}

export async function createUser(
  email: string,
  name: string,
  password: string
): Promise<SessionUser> {
  const passwordHash = await hashPassword(password);
  const rows = await query<{ id: string; email: string; name: string }>(
    `INSERT INTO automator_users (email, name, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, email, name`,
    [email.toLowerCase(), name, passwordHash]
  );
  return rows[0];
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
