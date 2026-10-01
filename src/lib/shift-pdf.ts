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
// Pages are batched rather than sent as one document. A 100-question paper with
// options and explanations is far larger than one response can hold, and a
// single 20MB upload as base64 blows past the inline request limit besides.
import { PDFParse } from "pdf-parse";
import { AIProviderError, callGeminiSchema, type GeminiPart } from "./gemini";
import {
  EXAM_SECTIONS,
  type ExamShift,
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

// Gap between batches, to stay under the Gemini free tier's requests-per-minute
// ceiling. Deliberately well clear of the limit rather than tuned against it.
const INTER_CHUNK_DELAY_MS = 2000;

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

export interface ParsedShiftPage {
  num: number;
  /** PNG bytes of the rasterised page. */
  png: Uint8Array;
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
 * Rasterise every page of the PDF to PNG.
 *
 * The buffer is consumed here — pdf.js transfers the bytes to its worker
 * thread, so `buf` must not be reused by the caller afterwards. Callers should
 * pass a copy if they still need the bytes.
 */
export async function extractPdfPages(buf: ArrayBuffer): Promise<ParsedShiftPage[]> {
  // pdf-parse wants a TypedArray; passing Uint8Array lets pdf.js transfer the
  // buffer to its worker instead of structured-cloning a copy.
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    // Rendered page by page and dropped as we go: holding every page of a
    // 28-page scan in memory at once is tens of megabytes of PNG that never
    // needs to coexist with the base64 copies we are about to make.
    const shots = await parser.getScreenshot({
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

function chunkPages(pages: ParsedShiftPage[]): ParsedShiftPage[][] {
  const chunks: ParsedShiftPage[][] = [];
  for (let i = 0; i < pages.length; i += PAGES_PER_CHUNK) {
    chunks.push(pages.slice(i, i + PAGES_PER_CHUNK));
  }
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
 * Parse an uploaded shift PDF into structured questions.
 *
 * `fallbackName` labels the shift when the paper never prints one.
 */export async function parseShiftPdf(buf: ArrayBuffer, fallbackName: string): Promise<ParsedShift> {
  // One parse only: the buffer is transferred to pdf.js' worker, so a second
  // pass would read detached memory.
  const pages = await extractPdfPages(buf);
  if (pages.length === 0) {
    throw new ShiftPdfError("This PDF has no readable pages", 422);
  }

  // Page image sizes are the only diagnostic left now that nothing tries to
  // extract text: a page that rendered to almost nothing is a blank or a
  // failed rasterisation, and that is what "unreadable" now means.
  console.log(
    `[shift-pdf] pages=${pages.length} imageBytes=${pages.reduce((a, p) => a + p.png.length, 0)} ` +
      `[${pages.map((p) => `${p.num}:${Math.round(p.png.length / 1024)}k`).join(" ")}]`
  );

  // Chunks run one at a time inside a plain for..of loop, deliberately. Each
  // batch is a multi-megabyte image request, and the Gemini free tier counts
  // requests per minute: firing batches in parallel trips the quota and every
  // concurrent batch then fails together, losing whole pages of the paper.
  let extractionsSeen = 0;
  const chunks = chunkPages(pages);

  // Status is recorded per chunk *index*. Previously failures were pushed into a
  // flat array, so `failures[i]` was the i-th failure rather than the i-th
  // chunk: two failures anywhere shifted every later index, marking healthy
  // chunks as unreadable and the actually-failed ones as read. A 25-page paper
  // then reported nearly all pages skipped while most had parsed fine.
  const results: ChunkResult[] = [];
  for (const [index, chunk] of chunks.entries()) {
    // Pace the batches. Sequential alone is not enough: an OCR call returns in a
    // few seconds, so a 28-page paper would otherwise fire its five batches back
    // to back and collide with the free tier's per-minute request ceiling.
    // Skipped before the first batch so an upload is not delayed for nothing.
    if (index > 0) await sleep(INTER_CHUNK_DELAY_MS);
    try {
      const parts = buildChunkParts(chunk, extractionsSeen === 0);
      const raw = await callChunkWithRetry(parts, index);
      extractionsSeen += 1;
      results.push({ ok: true, extraction: raw, index });
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

  // A page can be missing for two reasons that need different fixes. A page
  // whose rasterisation came back empty is unreadable by anyone — the scan
  // itself is unusable. A page that rendered fine but whose batch hit the rate
  // limit is recoverable by re-uploading once the limit clears.
  const blankPages = new Set(pages.filter((p) => p.png.length === 0).map((p) => p.num));
  const readPages = new Set(
    chunks.filter((_, i) => readChunks.has(i)).flatMap((c) => c.map((p) => p.num))
  );
  const unreadablePages: number[] = [];
  for (let n = 1; n <= pages.length; n += 1) {
    if (!readPages.has(n)) unreadablePages.push(n);
  }

  console.log(
    `[shift-pdf] chunks=${chunks.length} read=${readChunks.size} questions=${questions.length} ` +
      `withAnswers=${questions.filter((q) => q.correctAnswer !== null).length} ` +
      `blankPages=${blankPages.size ? [...blankPages].join(",") : "none"} ` +
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
