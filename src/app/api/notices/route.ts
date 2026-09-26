import { NextRequest } from "next/server";
import { loadNotices, saveNotices } from "@/lib/notices-store";
import { isAdminRequest } from "@/lib/auth-store";
import type { SscNotice } from "@/lib/ssc-notices";

export const runtime = "nodejs";

// GET /api/notices — the full (admin-editable) SSC notice list.
export async function GET() {
  const notices = await loadNotices();
  return Response.json({ notices });
}

// PUT /api/notices { notices: SscNotice[] } — replace the whole board.
export async function PUT(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }
  let body: { notices?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(body.notices)) {
    return Response.json({ error: "notices must be an array" }, { status: 400 });
  }
  const notices = body.notices as SscNotice[];
  await saveNotices(notices);
  return Response.json({ ok: true, notices });
}