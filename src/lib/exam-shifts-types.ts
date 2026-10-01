// Shared types and constants for the live-exam shift analysis.
//
// Deliberately dependency-free (no fs, no Redis) so client components can
// import these without pulling Node built-ins into the browser bundle. The
// server-only persistence lives in exam-shifts-store.ts.

export const EXAM_SECTIONS = [
  "General Intelligence",
  "General Awareness",
  "Quantitative Aptitude",
  "English Comprehension",
] as const;

export type ExamSection = (typeof EXAM_SECTIONS)[number];
export type ShiftDifficulty = "easy" | "medium" | "hard";

export interface ShiftQuestion {
  id: string;
  question: string;
  topic: string;
  section: string;
  difficulty: ShiftDifficulty;
  options?: string[];
  /**
   * Zero-based index into `options`, or null when the paper marked no answer.
   *
   * Null is a real value, not a missing one: it means "this paper showed no
   * answer key for this question", which the UI reports and which stops a
   * guessed answer from being presented as fact.
   */
  correctAnswer?: number | null;
  explanation?: string;
}

export interface ExamShift {
  id: string;
  name: string;
  examDate: string;
  questions: ShiftQuestion[];
}

/** One batch of a scanned paper, addressed by the page numbers it covers. */
export interface PageBatch {
  index: number;
  pages: number[];
}

/**
 * What one batch's OCR produced, before it is merged with the other batches.
 *
 * Produced by the server per batch, then merged by the browser, so this shape
 * crosses the wire and is therefore validated on arrival rather than assumed.
 */
export interface BatchExtraction {
  shiftName: string;
  examDate: string;
  questions: ShiftQuestion[];
}

export interface ExamShiftData {
  exam: string;
  updatedAt: string;
  shifts: ExamShift[];
}

export const DEFAULT_EXAM_NAME = "SSC CGL 2026 Tier-I";
