import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { assertAppEnv } from "@/lib/env";
import { query } from "@/lib/db";

export const SESSION_COOKIE = "kastok_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export type AuthUser = {
  id: string;
  email: string;
  role: string;
};

type SessionPayload = AuthUser & {
  exp: number;
};

function sign(value: string) {
  const { authSecret } = assertAppEnv();
  return createHmac("sha256", authSecret).update(value).digest("base64url");
}

function encode(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.id || !payload.email || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createSessionToken(user: AuthUser) {
  return encode({
    ...user,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE
  });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = decode(token);
  if (!payload) return null;

  const { rows } = await query<AuthUser>(
    "select id, email, role from users where id = $1 limit 1",
    [payload.id]
  );

  return rows[0] || null;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE
  };
}
