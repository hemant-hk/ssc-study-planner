import { NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/auth-store";
import { countPdfPages, parsePdfBatch, ShiftPdfError, MAX_PDF_BYTES } from "@/lib/shift-pdf";

export const runtime = "nodejs";
// One batch is one rasterisation plus one model call, comfortably under the
// ceiling. This is the whole point of the split: the old single-request parse
// held one function open for the sum of every batch and died at the gateway.
export const maxDuration = 60;

// Ceiling on pages per request, matching the planner's batch size. Enforced on
// top of the planner so a hand-made request cannot turn one "batch" into a whole
// paper and reintroduce the timeout this split exists to remove.
const MAX_PAGES_PER_REQUEST = 6;

// POST /api/admin/shift-pdf/process-chunk
//   multipart/form-data: file=<the PDF>, batch=<zero-based index>,
//   pages=<comma-separated 1-based page numbers>, isFirst=<"true"|"false">
//
// OCRs one batch of pages and returns its questions. The caller runs the loop
// and paces it, so a rate-limited batch can be retried on its own without
// redoing the batches that already succeeded.
//
// Admin-only, and admin-gated per batch rather than once per paper: without
// that, an unauthenticated caller could farm model calls one cheap batch at a
// time against an endpoint that is meant to be closed.
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

  const buf = await file.arrayBuffer();
  const header = new TextDecoder("latin1").decode(buf.slice(0, 5));
  if (header !== "%PDF-") {
    return Response.json({ error: "That file is not a PDF" }, { status: 415 });
  }

  // Page numbers arrive from the client and are used as pdf.js page indices, so
  // they are bounds-checked against the document rather than trusted: a hostile
  // range would otherwise ask the renderer for pages that do not exist, or for
  // the whole paper in one "batch" and reintroduce the timeout this split
  // exists to avoid.
  const rawPages = String(form.get("pages") || "")
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n > 0);
  const batchIndex = Number.parseInt(String(form.get("batch") ?? "0"), 10);
  const isFirst = String(form.get("isFirst") ?? "false") === "true";

  if (rawPages.length === 0) {
    return Response.json({ error: "Give the pages this batch covers" }, { status: 400 });
  }
  if (rawPages.length > MAX_PAGES_PER_REQUEST) {
    return Response.json(
      { error: `A batch may cover at most ${MAX_PAGES_PER_REQUEST} pages` },
      { status: 400 }
    );
  }

  // pdf.js transfers the bytes it is handed to its worker thread, which leaves
  // the caller's ArrayBuffer detached and unusable. Both calls below open the
  // document, so each gets its own copy — measured at 2ms for page count and
  // ~560ms for six pages of rasterisation, cheap next to the model call.
  let totalPages: number;
  try {
    totalPages = await countPdfPages(buf.slice(0));
  } catch (err) {
    if (err instanceof ShiftPdfError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "Could not read this PDF" },
      { status: 500 }
    );
  }

  const outOfRange = rawPages.filter((n) => n > totalPages);
  if (outOfRange.length > 0) {
    return Response.json(
      { error: `This PDF has ${totalPages} page(s); asked for ${outOfRange.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const extraction = await parsePdfBatch(buf.slice(0), rawPages, isFirst);
    return Response.json({
      ok: true,
      batch: Number.isInteger(batchIndex) ? batchIndex : 0,
      pages: rawPages,
      extraction,
    });
  } catch (err) {
    if (err instanceof ShiftPdfError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "Could not read these pages" },
      { status: 500 }
    );
  }
}
