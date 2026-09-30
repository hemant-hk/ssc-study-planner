import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

export const runtime = "nodejs";

const SESSION_COOKIE = "app_session";
const ONE_YEAR = 60 * 60 * 24 * 365;

function safeEqual(candidate: string, expected: string): boolean {
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Verify the app passcode and set a secure, HttpOnly session cookie so the
// proxy gate (src/proxy.ts) lets the user through on subsequent requests.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const passcode =
    body && typeof body === "object" && "passcode" in body
      ? (body as { passcode?: unknown }).passcode
      : undefined;

  const accessKey = process.env.APP_ACCESS_KEY;
  if (!accessKey) {
    return NextResponse.json(
      { error: "Gate not configured", detail: "APP_ACCESS_KEY is not set on the server" },
      { status: 500 }
    );
  }

  if (typeof passcode !== "string" || !safeEqual(passcode, accessKey)) {
    return NextResponse.json({ error: "Incorrect passcode. Try again." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, accessKey, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return res;
}