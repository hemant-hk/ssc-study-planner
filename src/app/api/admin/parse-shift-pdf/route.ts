import { NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/auth-store";
import { loadExamShifts, saveExamShifts, nextShiftId } from "@/lib/exam-shifts-store";
import {
  parseShiftPdf,
  toStoredShift,
  ShiftPdfError,
  MAX_PDF_BYTES,
} from "@/lib/shift-pdf";

export const runtime = "nodejs";
// A ~100-question paper is chunked into several model calls, so allow more than
// the default 5s serverless timeout. The work is a handful of page-sized Gemini
// requests, not a long poll.
export const maxDuration = 300;

// POST /api/admin/parse-shift-pdf  (multipart/form-data, field "file")
//
// Reads an uploaded shift paper, extracts its questions, and appends the shift
// to the live board. Admin-only: this is the only path that adds questions
// automatically, and an unauthenticated caller must not be able to write a
// fabricated paper into the analysis.
export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected multipart/form-data with a file" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: 'Attach the paper as the "file" field' }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ error: "That file is empty" }, { status: 400 });
  }
  if (file.size > MAX_PDF_BYTES) {
    return Response.json(
      { error: `PDF is ${(file.size / 1024 / 1024).toFixed(1)}MB; the limit is ${MAX_PDF_BYTES / 1024 / 1024}MB` },
      { status: 413 }
    );
  }

  // Type-check on content, not the browser-supplied name or MIME type: those
  // are client-controlled. A real PDF starts with the %PDF- magic bytes.
  const buf = await file.arrayBuffer();
  const header = new TextDecoder("latin1").decode(buf.slice(0, 5));
  if (header !== "%PDF-") {
    return Response.json({ error: "That file is not a PDF" }, { status: 415 });
  }

  const board = await loadExamShifts();
  const fallbackName = file.name.replace(/\.pdf$/i, "").trim() || `Shift ${board.shifts.length + 1}`;

  try {
    const parsed = await parseShiftPdf(buf, fallbackName);
    // `buf` is intentionally not referenced past here: pdf.js has already
    // transferred its bytes to its worker and dropped them on destroy.

    const shift = toStoredShift(parsed, nextShiftId(board.shifts));
    const next = {
      exam: board.exam,
      updatedAt: new Date().toISOString(),
      // A shift name can repeat if the same paper is uploaded twice. Replace
      // that shift rather than storing two copies of one paper, which would
      // make every question look like an in-shift repeat.
      shifts: [...board.shifts.filter((s) => s.name !== shift.name), shift],
    };
    await saveExamShifts(next);

    return Response.json({
      ok: true,
      shift,
      unreadablePages: parsed.unreadablePages,
      data: next,
    });
  } catch (err) {
    if (err instanceof ShiftPdfError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "Could not parse this PDF" },
      { status: 500 }
    );
  }
}
