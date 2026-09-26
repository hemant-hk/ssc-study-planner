import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  seedAuth,
  createUser,
  createSession,
  toSafeUser,
} from "@/lib/auth-store";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/session-crypto";

export const runtime = "nodejs";

// POST /api/auth/signup { name, email, password, targetExam?, dailyGoal? }
// Creates a student account and signs them in with a session cookie.
export async function POST(request: NextRequest) {
  await seedAuth();

  let body: { name?: unknown; email?: unknown; password?: unknown; targetExam?: unknown; dailyGoal?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name : "";
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  const targetExam = typeof body.targetExam === "string" ? body.targetExam : "";
  const dailyGoalRaw = typeof body.dailyGoal === "string" ? body.dailyGoal : "";

  const result = await createUser({
    name,
    email,
    password,
    targetExam,
    dailyGoal: dailyGoalRaw ? Number(dailyGoalRaw) : undefined,
  });
  if (!result) {
    return Response.json(
      { error: "Could not create account (bad email, short password, or email already in use)" },
      { status: 400 }
    );
  }

  const token = await createSession(result);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return Response.json({ user: toSafeUser(result) }, { status: 201 });
}