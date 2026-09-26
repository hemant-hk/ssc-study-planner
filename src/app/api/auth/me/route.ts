import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  sessionToUser,
  updateProfile,
  toSafeUser,
  SESSION_COOKIE,
} from "@/lib/auth-store";

export const runtime = "nodejs";

async function currentUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return sessionToUser(token);
}

// GET /api/auth/me — current user from the httpOnly session cookie (401 if out).
export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  return Response.json({ user: toSafeUser(user) });
}

// PATCH /api/auth/me { name?, targetExam?, dailyGoal? } — update the profile.
export async function PATCH(request: NextRequest) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  let body: { name?: unknown; targetExam?: unknown; dailyGoal?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: { name?: string; targetExam?: string; dailyGoal?: number } = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name;
  if (typeof body.targetExam === "string") patch.targetExam = body.targetExam;
  if (typeof body.dailyGoal === "number" || typeof body.dailyGoal === "string") {
    const v = Number(body.dailyGoal);
    if (Number.isFinite(v)) patch.dailyGoal = v;
  }

  const updated = await updateProfile(user.id, patch);
  if (!updated) return Response.json({ error: "User not found" }, { status: 404 });
  return Response.json({ user: toSafeUser(updated) });
}