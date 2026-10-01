// Store for the live-exam shift analysis. While an exam is running, aspirants
// report the questions from their shift; the same question often shows up in
// more than one shift, and that repetition is the single most useful signal for
// the next tier — so we keep the raw per-shift questions here and let
// exam-analysis.ts derive the cross-shift picture.
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "exam-shifts.json");

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

// Starter content so the section is meaningful before the admin adds the live
// paper. Shift 1 and Shift 2 deliberately share three questions: that overlap is
// what the repeat analysis is built to surface.
const SEED: ExamShiftData = {
  exam: "SSC CGL 2026 Tier-I",
  updatedAt: "2026-10-01T00:00:00.000Z",
  shifts: [
    {
      id: "shift-1",
      name: "Shift 1",
      examDate: "2026-09-28",
      questions: [
        {
          id: "s1q1",
          question:
            "Which Article of the Indian Constitution deals with the Right to Constitutional Remedies?",
          topic: "Indian Polity",
          section: "General Awareness",
          difficulty: "easy",
          options: ["Article 12", "Article 19", "Article 21", "Article 32"],
          correctAnswer: 3,
          explanation:
            "Article 32 (Dr. Ambedkar called it the heart and soul of the Constitution) lets a citizen move the Supreme Court to enforce Fundamental Rights.",
        },
        {
          id: "s1q2",
          question: "The Tropic of Cancer passes through how many Indian states?",
          topic: "Indian Geography",
          section: "General Awareness",
          difficulty: "medium",
          options: ["6", "7", "8", "9"],
          correctAnswer: 2,
          explanation:
            "Eight states: Gujarat, Rajasthan, Madhya Pradesh, Chhattisgarh, Jharkhand, West Bengal, Tripura and Mizoram.",
        },
        {
          id: "s1q3",
          question: "If the sum of two numbers is 42 and their product is 437, the numbers are:",
          topic: "Algebra",
          section: "Quantitative Aptitude",
          difficulty: "medium",
          options: ["19 and 23", "21 and 21", "14 and 28", "17 and 25"],
          correctAnswer: 0,
          explanation: "19 + 23 = 42 and 19 x 23 = 437, so the numbers are 19 and 23.",
        },
        {
          id: "s1q4",
          question: "Choose the word that is spelt correctly:",
          topic: "Spelling",
          section: "English Comprehension",
          difficulty: "easy",
          options: ["Accomodation", "Acommodation", "Accommodation", "Accommadation"],
          correctAnswer: 2,
          explanation: "Double c and double m — accommodation.",
        },
        {
          id: "s1q5",
          question: "A train 180 m long runs at 54 km/h and overtakes a train 120 m long running at 36 km/h in the same direction. The time taken is:",
          topic: "Speed and Distance",
          section: "Quantitative Aptitude",
          difficulty: "hard",
          options: ["30 s", "45 s", "60 s", "72 s"],
          correctAnswer: 2,
          explanation:
            "Relative speed = 54 - 36 = 18 km/h = 5 m/s. Total distance to clear = 180 + 120 = 300 m, so 300 / 5 = 60 s.",
        },
      ],
    },
    {
      id: "shift-2",
      name: "Shift 2",
      examDate: "2026-09-28",
      questions: [
        {
          id: "s2q1",
          question:
            "Which Article of the Indian Constitution deals with the Right to Constitutional Remedies?",
          topic: "Indian Polity",
          section: "General Awareness",
          difficulty: "easy",
          options: ["Article 12", "Article 19", "Article 21", "Article 32"],
          correctAnswer: 3,
          explanation:
            "Article 32 (Dr. Ambedkar called it the heart and soul of the Constitution) lets a citizen move the Supreme Court to enforce Fundamental Rights.",
        },
        {
          id: "s2q2",
          question: "The Tropic of Cancer passes through how many Indian states?",
          topic: "Indian Geography",
          section: "General Awareness",
          difficulty: "medium",
          options: ["6", "7", "8", "9"],
          correctAnswer: 2,
          explanation:
            "Eight states: Gujarat, Rajasthan, Madhya Pradesh, Chhattisgarh, Jharkhand, West Bengal, Tripura and Mizoram.",
        },
        {
          id: "s2q3",
          question: "Who wrote the Gitanjali (English version) collection of poems?",
          topic: "Literature",
          section: "General Awareness",
          difficulty: "easy",
          options: ["Rabindranath Tagore", "Sarojini Naidu", "Bankim Chandra Chattopadhyay", "Premchand"],
          correctAnswer: 0,
          explanation: "Rabindranath Tagore; he won the 1913 Nobel Prize in Literature for it.",
        },
        {
          id: "s2q4",
          question: "Choose the word that is spelt correctly:",
          topic: "Spelling",
          section: "English Comprehension",
          difficulty: "easy",
          options: ["Accomodation", "Acommodation", "Accommodation", "Accommadation"],
          correctAnswer: 2,
          explanation: "Double c and double m — accommodation.",
        },
        {
          id: "s2q5",
          question: "In a 400 m race A beats B by 40 m, and B beats C by 40 m. By how much does A beat C?",
          topic: "Time and Work",
          section: "Quantitative Aptitude",
          difficulty: "hard",
          options: ["64 m", "70 m", "76 m", "80 m"],
          correctAnswer: 2,
          explanation:
            "A:B = 400:360 = 10:9 and B:C = 10:9, so A:C = 100:81. When A covers 400 m, C covers 324 m, so A beats C by 76 m.",
        },
      ],
    },
  ],
};

export async function loadExamShifts(): Promise<ExamShiftData> {
  if (!existsSync(FILE)) return SEED;
  try {
    const raw = await readFile(FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.shifts)) {
      return parsed as ExamShiftData;
    }
    return SEED;
  } catch {
    return SEED;
  }
}

export async function saveExamShifts(data: ExamShiftData): Promise<void> {
  const dir = path.join(process.cwd(), "data");
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(FILE, JSON.stringify(data, null, 2));
}

// Keep a stable id per shift so the editor can target one shift without
// rewriting the whole board on every keystroke.
export function nextShiftId(shifts: ExamShift[]): string {
  const used = new Set(shifts.map((s) => s.id));
  let n = shifts.length + 1;
  while (used.has(`shift-${n}`)) n++;
  return `shift-${n}`;
}

export function nextQuestionId(shift: ExamShift): string {
  const used = new Set(shift.questions.map((q) => q.id));
  let n = shift.questions.length + 1;
  while (used.has(`q${n}`)) n++;
  return `${shift.id}q${n}`;
}
