// Store for the live-exam shift analysis.
//
// While an exam runs, the admin enters the questions reported from each shift;
// the same question often reappears in other shifts, and that repetition is the
// single most useful signal for the next tier, so we keep the raw per-shift
// questions here and let exam-analysis.ts derive the cross-shift picture.
//
// Persistence is tiered like the rest of the app: Upstash Redis is the source of
// truth (so the board survives redeploys and is shared across devices), and a
// local JSON file mirrors it when the cloud is unreachable or not configured.
// There is no seed content — an empty board is a real empty state, because the
// admin panel is the only way questions get in and we must never show invented
// questions as if they were reported from a shift.
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import {
  getServerRedis,
  markRedisReachable,
  markRedisUnreachable,
} from "./server-redis";
import {
  EXAM_SECTIONS,
  DEFAULT_EXAM_NAME,
  type ExamShift,
  type ExamShiftData,
  type ShiftQuestion,
  type ShiftDifficulty,
} from "./exam-shifts-types";

// Server-only: this module touches Redis and the filesystem, so it must never
// be imported from a client component.
export * from "./exam-shifts-types";

const REDIS_KEY = "shifts:cgl2026";
const FILE = path.join(process.cwd(), "data", "exam-shifts.json");

export function emptyBoard(): ExamShiftData {
  return { exam: DEFAULT_EXAM_NAME, updatedAt: "", shifts: [] };
}

function normalizeQuestion(raw: unknown): ShiftQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const q = raw as Record<string, unknown>;
  const question = typeof q.question === "string" ? q.question.trim() : "";
  if (!question) return null;
  const difficulty: ShiftDifficulty =
    q.difficulty === "easy" || q.difficulty === "hard" || q.difficulty === "medium" ? q.difficulty : "medium";
  const options = Array.isArray(q.options)
    ? q.options.filter((o): o is string => typeof o === "string" && o.trim().length > 0)
    : undefined;
  // An explicit null means the paper had no answer key; an absent field means
  // the question predates answer extraction. Both normalise to null, so the UI
  // can say "unmarked" rather than showing an option as correct on no evidence.
  const correctAnswer =
    typeof q.correctAnswer === "number" &&
    Number.isInteger(q.correctAnswer) &&
    options &&
    q.correctAnswer >= 0 &&
    q.correctAnswer < options.length
      ? q.correctAnswer
      : null;
  return {
    id: typeof q.id === "string" && q.id ? q.id : "",
    question,
    topic: typeof q.topic === "string" && q.topic.trim() ? q.topic.trim() : "General",
    section: typeof q.section === "string" && q.section.trim() ? q.section.trim() : EXAM_SECTIONS[0],
    difficulty,
    ...(options && options.length > 0 ? { options } : {}),
    correctAnswer,
    ...(typeof q.explanation === "string" && q.explanation.trim() ? { explanation: q.explanation } : {}),
  };
}

export function normalizeBoard(raw: unknown): ExamShiftData | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.shifts)) return null;
  const shifts = data.shifts
    .map((s, si) => {
      const shift = (s || {}) as Record<string, unknown>;
      const questions = (Array.isArray(shift.questions) ? shift.questions : [])
        .map(normalizeQuestion)
        .filter((q): q is ShiftQuestion => q !== null)
        .map((q, qi) => ({ ...q, id: q.id || `q${qi + 1}` }));
      return {
        id: typeof shift.id === "string" && shift.id ? shift.id : `shift-${si + 1}`,
        name: typeof shift.name === "string" && shift.name ? shift.name : `Shift ${si + 1}`,
        examDate: typeof shift.examDate === "string" ? shift.examDate : "",
        questions,
      };
    })
    .filter((s) => s.questions.length > 0 || s.name.length > 0);
  return {
    exam: typeof data.exam === "string" && data.exam ? data.exam : DEFAULT_EXAM_NAME,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
    shifts,
  };
}

async function readRedis(): Promise<ExamShiftData | null> {
  const redis = getServerRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(REDIS_KEY);
    if (raw === null || raw === undefined) {
      markRedisReachable();
      return null;
    }
    // The shared client disables automatic deserialization, so this is normally
    // the JSON string we stored.
    const text = typeof raw === "string" ? raw : JSON.stringify(raw);
    const parsed = normalizeBoard(JSON.parse(text));
    markRedisReachable();
    return parsed;
  } catch {
    markRedisUnreachable();
    return null;
  }
}

async function writeRedis(data: ExamShiftData): Promise<boolean> {
  const redis = getServerRedis();
  if (!redis) return false;
  try {
    await redis.set(REDIS_KEY, JSON.stringify(data));
    markRedisReachable();
    return true;
  } catch {
    markRedisUnreachable();
    return false;
  }
}

async function readFileBoard(): Promise<ExamShiftData | null> {
  if (!existsSync(FILE)) return null;
  try {
    return normalizeBoard(JSON.parse(await readFile(FILE, "utf-8")));
  } catch {
    return null;
  }
}

export async function loadExamShifts(): Promise<ExamShiftData> {
  return (await readRedis()) ?? (await readFileBoard()) ?? emptyBoard();
}

// Redis first; the file is a best-effort mirror so the board survives a cloud
// outage. Only fail if neither could be written.
export async function saveExamShifts(data: ExamShiftData): Promise<void> {
  const cloudOk = await writeRedis(data);
  try {
    const dir = path.join(process.cwd(), "data");
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    await writeFile(FILE, JSON.stringify(data, null, 2));
  } catch {
    if (!cloudOk) throw new Error("Failed to persist shift data");
  }
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
