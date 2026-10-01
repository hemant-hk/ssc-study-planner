import { NextRequest } from "next/server";
import { loadExamShifts, saveExamShifts, type ExamShiftData } from "@/lib/exam-shifts-store";
import { isAdminRequest } from "@/lib/auth-store";

export const runtime = "nodejs";

// GET /api/exam-shifts — the per-shift papers plus cross-shift analysis.
// Public: aspirants need to compare shifts while the exam is live.
export async function GET() {
  const data = await loadExamShifts();
  return Response.json({ data });
}

// PUT /api/exam-shifts { data: ExamShiftData } — replace the board.
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
  const incoming = body.data as ExamShiftData | undefined;
  if (!incoming || typeof incoming !== "object" || !Array.isArray(incoming.shifts)) {
    return Response.json({ error: "data.shifts must be an array" }, { status: 400 });
  }
  const shifts = incoming.shifts.map((s) => ({
    id: String(s?.id || ""),
    name: String(s?.name || ""),
    examDate: String(s?.examDate || ""),
    questions: Array.isArray(s?.questions) ? s.questions : [],
  }));
  const saved: ExamShiftData = {
    exam: String(incoming.exam || "SSC CGL"),
    updatedAt: new Date().toISOString(),
    shifts,
  };
  await saveExamShifts(saved);
  return Response.json({ ok: true, data: saved });
}
