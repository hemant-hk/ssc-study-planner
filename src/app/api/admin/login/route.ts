import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return Response.json({ error: "Admin password not configured" }, { status: 500 });
    }

    if (password === adminPassword) {
      return Response.json({ success: true, message: "Login successful" });
    } else {
      return Response.json({ error: "Invalid password" }, { status: 401 });
    }
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
