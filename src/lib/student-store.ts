import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import {
  blankProfile,
  QUALIFICATIONS,
  STUDY_SLOTS,
  TARGET_EXAMS,
  type StudentProfile,
} from "./student-options";
import {
  getServerRedis,
  markRedisReachable,
  markRedisUnreachable,
  hgetallToRecord,
} from "./server-redis";

// re-export the client-safe pieces for API routes
export { blankProfile, QUALIFICATIONS, STUDY_SLOTS, TARGET_EXAMS } from "./student-options";
export type { Qualification, StudentProfile, StudySlot, TargetExam } from "./student-options";

// Every browser gets its own student identity via the `sp_student` cookie, so
// each aspirant's details and progress stay separate instead of collapsing into
// one shared profile. The cookie only carries the opaque student id.

export const STUDENT_COOKIE = "sp_student";
const STUDENTS_FILE = path.join(process.cwd(), "data", "students.json");
// Upstash Redis hash holding the profiles (field = student id, value =
// JSON-encoded profile). The cloud copy is the canonical store so a student's
// details persist across devices; `students.json` is a local mirror used when
// the cloud is unreachable or not configured (same tiered pattern as the
// study-plan cache).
const PROFILES_HASH = "student_profiles";
const ONE_YEAR = 60 * 60 * 24 * 365;

const STUDENT_ID_RE = /^sp_[a-z0-9-]{8,}$/i;

// Resolve the caller from the cookie, minting a fresh identity on first visit.
export function resolveStudentId(request: NextRequest): { id: string; isNew: boolean } {
  const existing = request.cookies.get(STUDENT_COOKIE)?.value;
  if (existing && STUDENT_ID_RE.test(existing)) return { id: existing, isNew: false };
  return { id: `sp_${randomUUID()}`, isNew: true };
}

// Persist a freshly minted identity so the next request reuses it.
export function withStudentCookie<T extends NextResponse>(res: T, id: string, isNew: boolean): T {
  if (!isNew) return res;
  res.cookies.set(STUDENT_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return res;
}

async function readFileAll(): Promise<StudentProfile[]> {
  if (!existsSync(STUDENTS_FILE)) return [];
  try {
    const parsed = JSON.parse(await readFile(STUDENTS_FILE, "utf-8"));
    const list = Array.isArray(parsed) ? parsed : parsed?.students;
    return Array.isArray(list) ? (list as StudentProfile[]) : [];
  } catch {
    return [];
  }
}

async function writeFileAll(students: StudentProfile[]) {
  const dir = path.join(process.cwd(), "data");
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(STUDENTS_FILE, JSON.stringify({ students }, null, 2));
}

// Cloud-first read; the local file mirrors the hash so no profile is lost when
// the cloud is unavailable. Both stores are merged (cloud wins on conflict) so
// students minted during an outage still appear once the cloud is reachable.
async function readAll(): Promise<StudentProfile[]> {
  const fileAll = await readFileAll();
  const redis = getServerRedis();
  if (!redis) return fileAll;
  try {
    const all = await redis.hgetall(PROFILES_HASH);
    markRedisReachable();
    const map: Record<string, StudentProfile> = {};
    for (const s of fileAll) map[s.id] = s;
    for (const [id, raw] of Object.entries(hgetallToRecord(all))) {
      if (!raw) continue;
      try {
        const p = JSON.parse(raw) as StudentProfile;
        if (p && typeof p === "object" && p.id === id) map[id] = p;
      } catch {
        // Corrupt/partial rows are best-effort; keep the file copy.
      }
    }
    return Object.values(map);
  } catch {
    markRedisUnreachable();
    return fileAll;
  }
}

export async function getStudent(id: string): Promise<StudentProfile | null> {
  if (!id) return null;
  return (await readAll()).find((s) => s.id === id) ?? null;
}

export async function listStudents(): Promise<StudentProfile[]> {
  const all = await readAll();
  return all.sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
}

export async function saveStudent(next: StudentProfile): Promise<StudentProfile> {
  const all = await readAll();
  const now = new Date().toISOString();
  const existing = all.find((s) => s.id === next.id);
  const record: StudentProfile = {
    ...next,
    id: next.id,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  const nextList = existing
    ? all.map((s) => (s.id === next.id ? record : s))
    : [...all, record];

  // Mirror to the local file first so the profile survives cloud outages and
  // syncs across devices that share this server (like data/subjects.json).
  let fileError: string | null = null;
  try {
    await writeFileAll(nextList);
  } catch (err) {
    fileError = err instanceof Error ? err.message : "file write failed";
  }

  const redis = getServerRedis();
  if (redis) {
    try {
      await redis.hset(PROFILES_HASH, { [next.id]: JSON.stringify(record) });
      markRedisReachable();
      return record;
    } catch {
      markRedisUnreachable();
      // Cloud failed but the file mirror already saved it — still fine.
      if (fileError === null) return record;
    }
  }
  if (fileError === null) return record;
  throw new Error(fileError);
}

const asString = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Placeholder option values some UIs send instead of an empty string. Treat
// them like "not selected" rather than storing the literal label.
const PLACEHOLDER = new Set(["select", "-", "pending", "n/a"]);

function cleanEnum<T extends readonly string[]>(value: unknown, allowed: T): T[number] | "" {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw || PLACEHOLDER.has(raw.toLowerCase())) return "";
  return (allowed as readonly string[]).includes(raw) ? (raw as T[number]) : "";
}

export function normalizeProfileInput(id: string, body: unknown): StudentProfile {
  const b = (body && typeof body === "object" && !Array.isArray(body)
    ? body
    : {}) as Record<string, unknown>;
  const dailyGoalRaw = Number(b.dailyGoal);
  const yearRaw = asString(b.yearOfPassing, 4);
  return {
    ...blankProfile(id),
    name: asString(b.name, 80),
    email: asString(b.email, 120),
    phone: asString(b.phone, 20),
    city: asString(b.city, 80),
    college: asString(b.college, 120),
    qualification: cleanEnum(b.qualification, QUALIFICATIONS),
    yearOfPassing: /^\d{4}$/.test(yearRaw) ? yearRaw : "",
    targetExam: cleanEnum(b.targetExam, TARGET_EXAMS),
    examDate: /^\d{4}-\d{2}-\d{2}$/.test(asString(b.examDate, 10)) ? asString(b.examDate, 10) : "",
    dailyGoal: Number.isFinite(dailyGoalRaw) ? Math.max(0, Math.min(1440, Math.round(dailyGoalRaw))) : 0,
    studyTime: cleanEnum(b.studyTime, STUDY_SLOTS),
    goals: asString(b.goals, 1000),
  };
}