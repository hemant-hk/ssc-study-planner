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
  correctAnswer?: number;
  explanation?: string;
}

export interface ExamShift {
  id: string;
  name: string;
  examDate: string;
  questions: ShiftQuestion[];
}

export interface ExamShiftData {
  exam: string;
  updatedAt: string;
  shifts: ExamShift[];
}

export const DEFAULT_EXAM_NAME = "SSC CGL 2026 Tier-I";
