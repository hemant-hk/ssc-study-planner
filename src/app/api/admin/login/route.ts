import { NextRequest } from "next/server";
import { getAdminPassword } from "@/lib/admin-password";

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    const adminPassword = await getAdminPassword();

    if (!adminPassword) {
      return Response.json({ error: "Admin password not configured" }, { status: 500 });
    }

    // Trim stray whitespace (mobile keyboards often inject trailing spaces)
    // but keep the comparison case-sensitive.
    if (typeof password === "string" && password.trim() === adminPassword.trim()) {
      return Response.json({ success: true, message: "Login successful" });
    } else {
      return Response.json({ error: "Invalid password" }, { status: 401 });
    }
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}