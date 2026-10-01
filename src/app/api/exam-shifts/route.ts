import { NextRequest } from "next/server";
import {
  loadExamShifts,
  saveExamShifts,
  normalizeBoard,
  DEFAULT_EXAM_NAME,
} from "@/lib/exam-shifts-store";
import { isAdminRequest } from "@/lib/auth-store";

export const runtime = "nodejs";

// GET /api/exam-shifts — the per-shift papers. Read-only for everyone: the
// board is populated exclusively from the Admin panel so every question is
// verified, never crowdsourced. There is no public submission route.
export async function GET() {
  const data = await loadExamShifts();
  return Response.json({ data });
}

// PUT /api/exam-shifts { data: ExamShiftData } — replace the board (admin only).
export async function PUT(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }
  let body: { data?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const normalized = normalizeBoard(body.data);
  if (!normalized) {
    return Response.json({ error: "data.shifts must be an array" }, { status: 400 });
  }
  const toSave = {
    exam: normalized.exam || DEFAULT_EXAM_NAME,
    updatedAt: new Date().toISOString(),
    shifts: normalized.shifts,
  };
  await saveExamShifts(toSave);
  return Response.json({ ok: true, data: toSave });
}
