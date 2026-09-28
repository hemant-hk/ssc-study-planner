import { NextRequest } from "next/server";
import {
  seedAuth,
  verifyCredentials,
  createSession,
  toSafeUser,
} from "@/lib/auth-store";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/session-crypto";

export const runtime = "nodejs";

// POST /api/auth/login { email, password } -> sets an httpOnly session cookie
// and returns the signed-in user (without the password hash).
export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return Response.json({ error: "Email and password are required" }, { status: 400 });
  }

  // Credential verification and session creation depend on the local auth
  // store (fs) and WebCrypto. If either is unreachable or throws, report a
  // clean 401 instead of crashing the route with a 500.
  try {
    await seedAuth();

    const user = await verifyCredentials(email, password);
    if (!user) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await createSession(user);

    const res = new Response(JSON.stringify({ user: toSafeUser(user) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    res.headers.append(
      "Set-Cookie",
      `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${
        process.env.NODE_ENV === "production" ? "; Secure" : ""
      }`
    );
    return res;
  } catch (err) {
    console.error("POST /api/auth/login failed:", err);
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }
}