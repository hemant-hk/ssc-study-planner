import { NextRequest } from "next/server";
import {
  getAdminPassword,
  setAdminPassword,
  isAdminBearer,
} from "@/lib/admin-password";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: { currentPassword?: unknown; newPassword?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword) {
    return Response.json({ error: "Current password is required" }, { status: 400 });
  }
  if (!newPassword) {
    return Response.json({ error: "New password is required" }, { status: 400 });
  }
  if (newPassword.length < 4) {
    return Response.json({ error: "New password must be at least 4 characters" }, { status: 400 });
  }

  // Require a valid admin bearer token so only an authenticated admin can
  // change the password.
  if (!(await isAdminBearer(request.headers.get("authorization")))) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  const active = await getAdminPassword();
  if (currentPassword !== active) {
    return Response.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  await setAdminPassword(newPassword);

  return Response.json({ success: true, message: "Password updated successfully" });
}