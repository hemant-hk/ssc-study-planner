// Server-only: turns an uploaded shift paper (PDF) into structured questions.
//
// The whole pipeline is deliberately in-RAM. A shift paper is uploaded as a
// multipart FormData file, read with `file.arrayBuffer()`, parsed, summarised,
// and dropped — nothing is ever written to /tmp or public/. On a shared
// deployment that also keeps a competitor's paper from sitting on disk where
// the rest of the app (which serves files out of the project tree) could expose
// it.
//
// A shift paper is a scan, not a born-digital document: most pages carry no
// text layer at all, so anything that relies on extracted text returns nothing.
// Each page is therefore rasterised here and handed to Gemini as inline image
// data, and Gemini reads the page itself. pdf.js is still what turns the file
// into page images, but it is no longer the thing trying to read the text.
//
// This module handles ONE batch of pages per call and leaves the loop to the
// caller. It used to drive the whole paper itself, which meant one serverless
// function stayed open for the sum of every batch's model latency and died at
// the gateway partway through. The browser now walks the plan that planBatches
// returns, one short request per batch, which keeps every invocation well
// inside the platform's execution ceiling and lets a single failed batch be
// retried without redoing the ones that already worked.
import { PDFParse } from "pdf-parse";
import { AIProviderError, callGeminiSchema, type GeminiPart } from "./gemini";
import {
  EXAM_SECTIONS,
  type BatchExtraction,
  type PageBatch,
  type ShiftDifficulty,
  type ShiftQuestion,
} from "./exam-shifts-types";

// Pages per model call. Six pages of exam text is roughly 20 questions with
// options and answers, which fits one response with room to spare. Raising this
// is the first thing to try if a paper still drops questions, but every extra
// page also raises the odds of the whole batch truncating.
const PAGES_PER_CHUNK = 6;

// Wide enough for Gemini to read 8pt exam print reliably. Below this the OCR
// starts guessing digits in answer options, which is worse than no answer at all.
const PAGE_IMAGE_WIDTH = 1400;

// Each question now carries four options, an answer and an explanation, so a
// batch costs far more output than the old question-only schema.
const CHUNK_OUTPUT_TOKENS = 16000;

// One retry, after a pause long enough for the per-minute window to roll over.
// A 429 here is a rate limit, not a bad request, so it is the one error worth
// re-sending: the batch is idempotent and a short wait usually clears it.
const RATE_LIMIT_RETRY_MS = 5000;

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

export type { BatchExtraction, PageBatch };

export interface ParsedShiftPage {
  num: number;
  /** PNG bytes of the rasterised page. */
  png: Uint8Array;
}

/** How many pages fit in one batch, exposed so the UI can show progress. */
export const PAGES_PER_BATCH = PAGES_PER_CHUNK;

/**
 * Read a PDF's page count without rendering anything.
 *
 * Splitting a paper into batches needs the page count up front, and rendering
 * pages only to learn how many there are would waste the whole point of
 * splitting. `getInfo` is a metadata read: milliseconds, not seconds.
 */
export async function countPdfPages(buf: ArrayBuffer): Promise<number> {
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    const info = await parser.getInfo();
    if (!Number.isFinite(info.total) || info.total <= 0) {
      throw new ShiftPdfError("This PDF reports no pages", 422);
    }
    return info.total;
  } finally {
    await parser.destroy();
  }
}

/** Split a page count into the batches the client will each request. */
export function planBatches(totalPages: number): PageBatch[] {
  const batches: PageBatch[] = [];
  for (let start = 1; start <= totalPages; start += PAGES_PER_CHUNK) {
    const end = Math.min(start + PAGES_PER_CHUNK - 1, totalPages);
    batches.push({ index: batches.length, pages: range(start, end) });
  }
  return batches;
}

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let n = from; n <= to; n += 1) out.push(n);
  return out;
}

/**
 * Rasterise one batch of pages to PNG.
 *
 * The buffer is consumed here — pdf.js transfers the bytes to its worker
 * thread, so `buf` must not be reused by the caller afterwards. Callers should
 * pass a copy if they still need the bytes.
 */
export async function extractPdfPages(buf: ArrayBuffer, pages?: number[]): Promise<ParsedShiftPage[]> {
  // pdf-parse wants a TypedArray; passing Uint8Array lets pdf.js transfer the
  // buffer to its worker instead of structured-cloning a copy.
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    // Rendered page by page and dropped as we go: holding every page of a
    // 28-page scan in memory at once is tens of megabytes of PNG that never
    // needs to coexist with the base64 copies we are about to make.
    const shots = await parser.getScreenshot({
      ...(pages && pages.length > 0 ? { partial: pages } : {}),
      desiredWidth: PAGE_IMAGE_WIDTH,
      imageDataUrl: false,
      imageBuffer: true,
    });
    return shots.pages.map((p) => ({ num: p.pageNumber, png: p.data }));
  } finally {
    // Release pdf.js' worker and its cached page images even if parsing threw.
    await parser.destroy();
  }
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

export type { RawExtraction };

/** Normalise one batch's raw model output into stored questions. */
export function normalizeExtraction(raw: RawExtraction): BatchExtraction {
  return {
    shiftName: typeof raw.shiftName === "string" ? raw.shiftName.trim() : "",
    examDate: typeof raw.examDate === "string" ? raw.examDate.trim() : "",
    questions: mergeQuestions([raw]),
  };
}

/**
 * Fold every batch's output into one shift.
 *
 * Runs on the client, so each batch is treated as untrusted: it is whatever
 * came back over the wire, and a missing or malformed questions array has to
 * degrade to "this batch contributed nothing" rather than throw and take the
 * whole upload down. Each batch was already normalised server-side, so this
 * only has to dedup — a question straddling a page break can be reported by
 * two different batches.
 */
export function mergeBatches(
  batches: (BatchExtraction | null | undefined)[],
  fallbackName: string
): { shiftName: string; examDate: string; questions: ShiftQuestion[] } {
  const valid = batches.filter(
    (b): b is BatchExtraction => Boolean(b) && Array.isArray(b?.questions)
  );
  // The first batch that actually printed a name owns it, so a leading batch
  // that failed cannot steal the header from the batch that read it.
  const shiftName = valid.find((b) => b.shiftName?.trim())?.shiftName?.trim() || fallbackName;
  const examDate = valid.find((b) => b.examDate?.trim())?.examDate?.trim() || "";

  const seen = new Set<string>();
  const questions: ShiftQuestion[] = [];
  for (const q of valid.flatMap((b) => b.questions)) {
    if (!q || typeof q.question !== "string") continue;
    const key = q.question.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    questions.push(q);
  }
  return { shiftName, examDate, questions };
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
      const options = Array.isArray(q.options)
        ? q.options
            .map((o) => (typeof o === "string" ? o.trim() : ""))
            .filter((o) => o.length > 0)
        : [];
      const answer = toAnswerIndex(q.correctAnswerIndex, options.length);
      const explanation =
        typeof q.explanation === "string" && q.explanation.trim() ? q.explanation.trim() : "";
      out.push({
        id: "",
        question: text,
        topic: typeof q.topic === "string" && q.topic.trim() ? q.topic.trim() : "General",
        section: toSection(q.subject),
        difficulty: toDifficulty(q.difficulty),
        ...(options.length > 0 ? { options } : {}),
        // An unmarked answer is stored as null, not omitted: the UI needs to
        // tell "this paper showed no answer key" apart from data saved before
        // answers were extracted at all.
        correctAnswer: answer,
        ...(explanation ? { explanation } : {}),
      });
    }
  }
  return out;
}

/**
 * Map the model's zero-based answer index onto a stored option index.
 *
 * Anything outside the option range becomes null. The model reports -1 for
 * "not marked in this paper", and an out-of-range index means it read the
 * options but not the marking — either way there is no answer to trust, and
 * guessing one would quietly poison the repeat detection downstream.
 */
function toAnswerIndex(raw: unknown, optionCount: number): number | null {
  if (typeof raw !== "number" || !Number.isInteger(raw)) return null;
  if (raw < 0 || raw >= optionCount) return null;
  return raw;
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
          options: {
            type: "array",
            description: "The four answer options in printed order, without their (1)/(2)/(3)/(4) labels.",
            items: { type: "string" },
          },
          correctAnswerIndex: {
            type: "integer",
            description:
              "Zero-based index of the correct option: 0 for the first, 3 for the fourth. " +
              "Use -1 unless the paper itself marks this question's answer (a highlighted option, " +
              "a tick, or an answer key listing it). Never work the question out yourself.",
          },
          explanation: {
            type: "string",
            description: "One short line of the fact or calculation that settles the question.",
          },
          subject: {
            type: "string",
            enum: ["Quant", "Reasoning", "GS", "English"],
          },
          topic: { type: "string", description: 'Specific topic, e.g. "Polity - Articles", "Algebra", "Tides".' },
          difficulty: { type: "string", enum: ["Easy", "Medium", "Hard"] },
        },
        required: ["questionText", "options", "correctAnswerIndex", "explanation", "subject", "topic", "difficulty"],
      },
    },
  },
  required: ["shiftName", "examDate", "questions"],
} as const;

/** Build the multimodal request for one batch of pages: images, then the prompt. */
function buildChunkParts(pages: ParsedShiftPage[], isFirst: boolean): GeminiPart[] {
  const parts: GeminiPart[] = pages.map((p) => ({
    inlineData: { mimeType: "image/png", data: Buffer.from(p.png).toString("base64") },
  }));
  const label = pages.map((p) => `--- page ${p.num} ---`).join("\n");
  parts.push({
    text: `Extract exam questions from the ${pages.length} page image(s) above, taken from an SSC CGL Tier-I shift paper.

${label}

RULES:
- One entry per question, in printed order. Skip anything that is not a question (instructions, header banners, page numbers, standalone answer keys).
- questionText is the question stem only. Do not copy the options into it.
- options must hold all four choices in printed order, with the (1)/(2)/(3)/(4) labels stripped.
- correctAnswerIndex is the zero-based index of the right option, but ONLY when this paper itself reveals it for that question — a ticked or highlighted option, or a printed answer key. Otherwise return -1.
  Do not solve the question and do not use your own judgement. A memory-based paper's printed answer is frequently wrong, and a guessed answer is worse than an absent one: -1 keeps it honest.
- explanation is one short line giving the fact or working behind the answer. Empty string if the paper supplies none.
- subject must be one of: Quant, Reasoning, GS, English.
- topic must be the specific concept, not the broad subject. Prefer "Polity - Articles" over "Polity", "Time and Work" over "Quant", "Indian Rivers" over "GS".
- difficulty is your own judgement of how hard this looks for the exam: Easy, Medium, or Hard.
${isFirst ? '- shiftName and examDate: fill these only if this first chunk actually shows them.\n' : "- shiftName and examDate: return empty strings, another chunk owns the header.\n"}- If these pages contain no questions at all, return an empty questions array.`,
  });
  return parts;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Extract one batch, retrying once if it is rate limited.
 *
 * `callGeminiSchema` already retries twice per model, but with a 1s/2s backoff
 * that is far shorter than a free-tier per-minute window takes to reset — so a
 * batch that trips the quota comes back already exhausted and is lost with the
 * rest of that page range. One wait long enough to actually clear the window is
 * what turns a lost batch into a slow one.
 */
async function callChunkWithRetry(parts: GeminiPart[], index: number): Promise<RawExtraction> {
  try {
    return await callGeminiSchema<RawExtraction>("", EXTRACTION_SCHEMA, CHUNK_OUTPUT_TOKENS, parts);
  } catch (err) {
    if (!isRateLimited(err)) throw err;
    console.log(`[shift-pdf] batch ${index + 1} rate limited, waiting ${RATE_LIMIT_RETRY_MS}ms to retry`);
    await sleep(RATE_LIMIT_RETRY_MS);
    return callGeminiSchema<RawExtraction>("", EXTRACTION_SCHEMA, CHUNK_OUTPUT_TOKENS, parts);
  }
}

/** Only a 429 is worth re-sending; a schema or auth failure will fail again. */
function isRateLimited(err: unknown): boolean {
  return err instanceof AIProviderError && err.status === 429;
}

/**
 * OCR a single batch of pages and return its questions.
 *
 * Deliberately one batch per call. A whole 28-page paper used to be parsed in a
 * single request, which meant one serverless function held open for the sum of
 * every batch's model latency — far past the platform's execution ceiling, so
 * the upload died with a gateway timeout after the work had already been paid
 * for. Splitting the loop out to the caller keeps each invocation to one model
 * call, and the whole loop can then be paced and retried batch by batch.
 */
export async function parsePdfBatch(
  buf: ArrayBuffer,
  pages: number[],
  isFirstBatch: boolean
): Promise<BatchExtraction> {
  if (pages.length === 0) {
    throw new ShiftPdfError("No pages given for this batch", 400);
  }
  const rendered = await extractPdfPages(buf, pages);
  if (rendered.length === 0) {
    throw new ShiftPdfError(
      `Could not render page${pages.length > 1 ? "s" : ""} ${pages.join(", ")}`,
      422
    );
  }
  const parts = buildChunkParts(rendered, isFirstBatch);
  const raw = await callChunkWithRetry(parts, 0);
  const out = normalizeExtraction(raw ?? {});
  console.log(
    `[shift-pdf] batch pages=${pages.join(",")} rendered=${rendered.length} questions=${out.questions.length}`
  );
  return out;
}

export class ShiftPdfError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ShiftPdfError";
    this.status = status;
  }
}
