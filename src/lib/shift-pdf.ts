// Server-only: turns an uploaded shift paper (PDF) into structured questions.
//
// The whole pipeline is deliberately in-RAM. A shift paper is uploaded as a
// multipart FormData file, read with `file.arrayBuffer()`, parsed, summarised,
// and dropped — nothing is ever written to /tmp or public/. On a shared
// deployment that also keeps a competitor's paper from sitting on disk where
// the rest of the app (which serves files out of the project tree) could expose
// it.
//
// Text extraction is delegated to pdf-parse (pdf.js under the hood), and the
// structuring step to Gemini Flash with a response schema. Gemini reads scanned
// pages directly, so a photo-only memory paper needs no separate OCR pass.
import { PDFParse } from "pdf-parse";
import { callGeminiSchema } from "./gemini";
import {
  EXAM_SECTIONS,
  type ExamShift,
  type ShiftDifficulty,
  type ShiftQuestion,
} from "./exam-shifts-types";

// A shift paper is ~100 questions, which is far more than one model response
// can return. We page through the PDF and hand the model a few pages at a time,
// then merge. Keeping a chunk small also keeps a single bad page from taking
// the whole upload down with it.
const MAX_PAGES_PER_CHUNK = 4;

// Enough for a page of dense two-column exam text without truncating mid
// question; the model only needs to see a question and its options.
const CHARS_PER_CHUNK = 6000;

const SUBJECT_TO_SECTION: Record<string, string> = {
  quant: "Quantitative Aptitude",
  "quantitative aptitude": "Quantitative Aptitude",
  reasoning: "General Intelligence",
  "general intelligence": "General Intelligence",
  intelligence: "General Intelligence",
  gs: "General Awareness",
  "general studies": "General Awareness",
  "general awareness": "General Awareness",
  gk: "General Awareness",
  english: "English Comprehension",
  "english comprehension": "English Comprehension",
};

export const MAX_PDF_BYTES = 20 * 1024 * 1024;

export interface ParsedShiftPage {
  num: number;
  text: string;
}

export interface PdfText {
  pages: ParsedShiftPage[];
  /** Pages in the document, including ones with no extractable text. */
  total: number;
}

export interface ParsedShift {
  shiftName: string;
  examDate: string;
  questions: ShiftQuestion[];
  /** Pages whose text could not be read, e.g. a scanned image page. */
  unreadablePages: number[];
  /** How many page groups the paper was split into, for the admin's benefit. */
  chunkCount: number;
  /** Per-chunk failure detail, so a partial read is explainable. */
  failedChunks: string[];
}

type ChunkResult =
  | { ok: true; index: number; extraction: RawExtraction }
  | { ok: false; index: number; pages: number[]; message: string };

/**
 * Parse the PDF buffer into per-page text.
 *
 * The buffer is consumed here — pdf.js transfers the bytes to its worker
 * thread, so `buf` must not be reused by the caller afterwards.
 */
export async function extractPdfPages(buf: ArrayBuffer): Promise<PdfText> {
  // pdf-parse wants a TypedArray; passing Uint8Array lets pdf.js transfer the
  // buffer to its worker instead of structured-cloning a copy.
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    const result = await parser.getText();
    return {
      pages: result.pages
        .map((p) => ({ num: p.num, text: p.text ?? "" }))
        .filter((p) => p.text.trim().length > 0),
      total: result.total,
    };
  } finally {
    // Release pdf.js' worker and its cached page images even if parsing threw.
    await parser.destroy();
  }
}

function chunkPages(pages: ParsedShiftPage[]): ParsedShiftPage[][] {
  const chunks: ParsedShiftPage[][] = [];
  let current: ParsedShiftPage[] = [];
  let chars = 0;
  for (const page of pages) {
    const size = page.text.length;
    // Flush when adding this page would overflow the budget. A single oversized
    // page still gets its own chunk rather than being silently dropped.
    if (current.length > 0 && (chars + size > CHARS_PER_CHUNK || current.length >= MAX_PAGES_PER_CHUNK)) {
      chunks.push(current);
      current = [];
      chars = 0;
    }
    current.push(page);
    chars += size;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

function toSection(subject: unknown): string {
  if (typeof subject === "string") {
    const mapped = SUBJECT_TO_SECTION[subject.trim().toLowerCase()];
    if (mapped) return mapped;
  }
  return EXAM_SECTIONS[2];
}

function toDifficulty(value: unknown): ShiftDifficulty {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (v === "easy" || v === "hard" || v === "medium") return v;
  return "medium";
}

interface RawExtraction {
  shiftName?: unknown;
  examDate?: unknown;
  questions?: unknown;
}

function mergeQuestions(shifts: RawExtraction[]): ShiftQuestion[] {
  const seen = new Set<string>();
  const out: ShiftQuestion[] = [];
  for (const shift of shifts) {
    if (!Array.isArray(shift.questions)) continue;
    for (const raw of shift.questions) {
      if (!raw || typeof raw !== "object") continue;
      const q = raw as Record<string, unknown>;
      const text = typeof q.questionText === "string" ? q.questionText.trim() : "";
      if (text.length < 8) continue;
      // The same question can straddle a page break, so the model may report it
      // in two chunks. Dedup on normalized text before anything downstream
      // counts questions.
      const key = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: "",
        question: text,
        topic: typeof q.topic === "string" && q.topic.trim() ? q.topic.trim() : "General",
        section: toSection(q.subject),
        difficulty: toDifficulty(q.difficulty),
      });
    }
  }
  return out;
}

function pickShiftName(extractions: RawExtraction[], fallback: string): string {
  for (const e of extractions) {
    if (typeof e.shiftName === "string" && e.shiftName.trim()) return e.shiftName.trim();
  }
  return fallback;
}

function pickExamDate(extractions: RawExtraction[]): string {
  for (const e of extractions) {
    if (typeof e.examDate === "string" && e.examDate.trim()) return e.examDate.trim();
  }
  return "";
}

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    shiftName: {
      type: "string",
      description: 'Shift label exactly as printed, e.g. "Shift 1 - 24 Oct 2026". Empty string if absent.',
    },
    examDate: { type: "string", description: 'Exam date as printed, e.g. "24 Oct 2026". Empty string if absent.' },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          questionText: { type: "string", description: "Full question stem. Do not include the answer options." },
          subject: {
            type: "string",
            enum: ["Quant", "Reasoning", "GS", "English"],
          },
          topic: { type: "string", description: 'Specific topic, e.g. "Polity - Articles", "Algebra", "Tides".' },
          difficulty: { type: "string", enum: ["Easy", "Medium", "Hard"] },
        },
        required: ["questionText", "subject", "topic", "difficulty"],
      },
    },
  },
  required: ["shiftName", "examDate", "questions"],
} as const;

function buildChunkPrompt(pages: ParsedShiftPage[], isFirst: boolean): string {
  const label = pages.map((p) => `--- page ${p.num} ---`).join("\n");
  const body = pages.map((p) => p.text).join("\n");
  return `Extract exam questions from these pages of an SSC CGL Tier-I shift paper.

${label}
${body}

RULES:
- One entry per question. Skip anything that is not a question (instructions, header banners, page numbers, answer keys).
- questionText is the question stem only. Do not copy the options (1) (2) (3) (4) into it.
- subject must be one of: Quant, Reasoning, GS, English.
- topic must be the specific concept, not the broad subject. Prefer "Polity - Articles" over "Polity", "Time and Work" over "Quant", "Indian Rivers" over "GS".
- difficulty is your own judgement of how hard this looks for the exam: Easy, Medium, or Hard.
${isFirst ? '- shiftName and examDate: fill these only if this first chunk actually shows them.\n' : "- shiftName and examDate: return empty strings, another chunk owns the header.\n"}- If these pages contain no questions at all, return an empty questions array.`;
}

/**
 * Parse an uploaded shift PDF into structured questions.
 *
 * `fallbackName` labels the shift when the paper never prints one.
 */
export async function parseShiftPdf(buf: ArrayBuffer, fallbackName: string): Promise<ParsedShift> {
  // One parse only: the buffer is transferred to pdf.js' worker, so a second
  // pass would read detached memory.
  const { pages, total } = await extractPdfPages(buf);
  if (pages.length === 0) {
    throw new ShiftPdfError(
      total > 0
        ? "No text layer in this PDF — it looks like a scanned image"
        : "This PDF has no readable pages",
      422
    );
  }

  // Per-page character counts: the difference between "pdf-parse found no text"
  // and "the model was rate limited" decides whether a partial read is the
  // paper's fault or ours, and that was impossible to tell from the outside.
  const textStats = pages
    .map((p) => `${p.num}:${p.text.length}`)
    .join(" ");
  console.log(
    `[shift-pdf] pages=${total} withText=${pages.length} chars=${pages.reduce((a, p) => a + p.text.length, 0)} [${textStats}]`
  );

  // Chunks run one at a time. These are sequential page-sized model calls, and
  // firing many concurrently is what trips the rate limiter and loses whole
  // chunks — slower, but it keeps every page of a 25-page paper.
  let extractionsSeen = 0;
  const chunks = chunkPages(pages);

  // Status is recorded per chunk *index*. Previously failures were pushed into a
  // flat array, so `failures[i]` was the i-th failure rather than the i-th
  // chunk: two failures anywhere shifted every later index, marking healthy
  // chunks as unreadable and the actually-failed ones as read. A 25-page paper
  // then reported nearly all pages skipped while most had parsed fine.
  const results: ChunkResult[] = [];
  for (const [index, chunk] of chunks.entries()) {
    try {
      const raw = await callGeminiSchema<RawExtraction>(
        buildChunkPrompt(chunk, extractionsSeen === 0),
        EXTRACTION_SCHEMA
      );
      extractionsSeen += 1;
      results.push({ ok: true, extraction: raw ?? {}, index });
    } catch (err) {
      // Keep going: one rate-limited chunk must not discard the chunks that
      // succeeded, but the caller has to learn the paper is only partly read.
      results.push({
        ok: false,
        index,
        pages: chunk.map((p) => p.num),
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const extractions: RawExtraction[] = [];
  const failures: string[] = [];
  const readChunks = new Set<number>();

  for (const r of results) {
    if (r.ok) {
      readChunks.add(r.index);
      extractions.push(r.extraction);
    } else {
      failures.push(`pages ${r.pages.join(",")}: ${r.message}`);
    }
  }

  if (extractions.length === 0) {
    throw new ShiftPdfError(
      `Could not read this PDF with the AI (${failures[0] || "unknown error"})`,
      502
    );
  }

  const questions = mergeQuestions(extractions);
  if (questions.length === 0) {
    throw new ShiftPdfError("No questions found in this PDF", 422);
  }

  // Distinguish the two reasons a page can be missing, because they need very
  // different fixes from the admin. A page with no extracted text is a scanned
  // image and will never be readable; a page whose text was sent but whose chunk
  // failed is recoverable by re-uploading once the rate limit clears.
  const textPages = new Set(pages.map((p) => p.num));
  const readPages = new Set(
    chunks.filter((_, i) => readChunks.has(i)).flatMap((c) => c.map((p) => p.num))
  );
  const unreadablePages: number[] = [];
  for (let n = 1; n <= total; n += 1) {
    if (!readPages.has(n) && textPages.has(n)) unreadablePages.push(n);
  }

  console.log(
    `[shift-pdf] chunks=${chunks.length} read=${readChunks.size} questions=${questions.length} ` +
      `noTextPages=${[...textPages].length ? [...Array(total).keys()].map((i) => i + 1).filter((n) => !textPages.has(n)).join(",") || "none" : "none"} ` +
      `failedChunks=${failures.length ? failures.join(" | ") : "none"}`
  );

  return {
    shiftName: pickShiftName(extractions, fallbackName),
    examDate: pickExamDate(extractions),
    questions,
    unreadablePages,
    chunkCount: chunks.length,
    failedChunks: failures,
  };
}

export class ShiftPdfError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ShiftPdfError";
    this.status = status;
  }
}

/** Convert a parsed shift into a storable one with stable ids. */
export function toStoredShift(parsed: ParsedShift, id: string): ExamShift {
  return {
    id,
    name: parsed.shiftName,
    examDate: parsed.examDate,
    questions: parsed.questions.map((q, i) => ({ ...q, id: `${id}q${i + 1}` })),
  };
}
