import { NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/auth-store";
import {
  countPdfPages,
  planBatches,
  ShiftPdfError,
  MAX_PDF_BYTES,
  PAGES_PER_BATCH,
} from "@/lib/shift-pdf";

export const runtime = "nodejs";
// Reads page metadata only: no model call happens here, so this finishes in
// milliseconds and needs no headroom over the default timeout.
export const maxDuration = 30;

// POST /api/admin/shift-pdf/init  (multipart/form-data, field "file")
//
// Reports how many pages the paper has and how it will be split into batches.
// The client drives the loop from that plan and calls process-chunk once per
// batch.
//
// It deliberately does not cache the rasterised pages anywhere. This runs on a
// serverless runtime where the next request may land on a fresh instance, so
// anything held in memory would simply be gone; the client keeps the PDF it
// already uploaded and re-sends it per batch instead.
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

  try {
    const totalPages = await countPdfPages(buf);
    const batches = planBatches(totalPages);
    return Response.json({
      ok: true,
      totalPages,
      batchCount: batches.length,
      pagesPerBatch: PAGES_PER_BATCH,
      batches,
    });
  } catch (err) {
    if (err instanceof ShiftPdfError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "Could not read this PDF" },
      { status: 500 }
    );
  }
}
