import { NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/auth-store";
import { loadExamShifts, saveExamShifts, nextShiftId } from "@/lib/exam-shifts-store";
import { mergeBatches } from "@/lib/shift-pdf";
import type { BatchExtraction } from "@/lib/exam-shifts-types";

export const runtime = "nodejs";
// Redis read plus write, no model call. Short by design: the expensive OCR
// already happened one batch per request.
export const maxDuration = 30;

// POST /api/admin/shift-pdf/commit  (application/json)
//
//   { fallbackName: string, batches: BatchExtraction[] }
//
// Persists the client's merged OCR result. The questions are assembled in the
// browser — one request per batch is the only way to stay inside the platform's
// per-request execution ceiling — so this endpoint is the trust boundary where
// that client-produced data is validated and written.
//
// Admin-only: this is the only path that adds questions automatically, and an
// unauthenticated caller must not be able to write a fabricated paper into the
// analysis.
export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: { fallbackName?: unknown; batches?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON with the parsed batches" }, { status: 400 });
  }

  if (!Array.isArray(body.batches) || body.batches.length === 0) {
    return Response.json({ error: "No parsed batches to save" }, { status: 400 });
  }
  const batches = body.batches as BatchExtraction[];
  const fallbackName =
    typeof body.fallbackName === "string" && body.fallbackName.trim()
      ? body.fallbackName.trim().slice(0, 200)
      : "Shift";

  const merged = mergeBatches(batches, fallbackName);
  if (merged.questions.length === 0) {
    return Response.json(
      { error: "Those batches contained no questions" },
      { status: 422 }
    );
  }

  const board = await loadExamShifts();
  const id = nextShiftId(board.shifts);
  const shift = {
    id,
    name: merged.shiftName,
    examDate: merged.examDate,
    questions: merged.questions.map((q, i) => ({ ...q, id: `${id}q${i + 1}` })),
  };
  const next = {
    exam: board.exam,
    updatedAt: new Date().toISOString(),
    // A shift name can repeat if the same paper is uploaded twice. Replace that
    // shift rather than storing two copies of one paper, which would make every
    // question look like an in-shift repeat.
    shifts: [...board.shifts.filter((s) => s.name !== shift.name), shift],
  };

  try {
    await saveExamShifts(next);
  } catch {
    return Response.json({ error: "Could not save the shift" }, { status: 500 });
  }

  return Response.json({
    ok: true,
    shift,
    savedCount: shift.questions.length,
    sentBatches: batches.length,
    data: next,
  });
}
