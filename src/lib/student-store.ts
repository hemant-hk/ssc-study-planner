import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import {
  blankProfile,
  QUALIFICATIONS,
  STUDY_SLOTS,
  type StudentProfile,
} from "./student-options";

// re-export the client-safe pieces for API routes
export { blankProfile, QUALIFICATIONS, STUDY_SLOTS } from "./student-options";
export type { Qualification, StudentProfile, StudySlot, TargetExam } from "./student-options";

// Every browser gets its own student identity via the `sp_student` cookie, so
// each aspirant's details and progress stay separate instead of collapsing into
// one shared profile. Profiles live server-side in data/students.json; the
// cookie only carries the opaque student id.

export const STUDENT_COOKIE = "sp_student";
const STUDENTS_FILE = path.join(process.cwd(), "data", "students.json");
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

async function readAll(): Promise<StudentProfile[]> {
  if (!existsSync(STUDENTS_FILE)) return [];
  try {
    const parsed = JSON.parse(await readFile(STUDENTS_FILE, "utf-8"));
    const list = Array.isArray(parsed) ? parsed : parsed?.students;
    return Array.isArray(list) ? (list as StudentProfile[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(students: StudentProfile[]) {
  const dir = path.join(process.cwd(), "data");
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(STUDENTS_FILE, JSON.stringify({ students }, null, 2));
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
  await writeAll(nextList);
  return record;
}

const asString = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function normalizeProfileInput(id: string, body: unknown): StudentProfile {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const dailyGoalRaw = Number(b.dailyGoal);
  const yearRaw = asString(b.yearOfPassing, 4);
  const qualification = QUALIFICATIONS.includes(b.qualification as (typeof QUALIFICATIONS)[number])
    ? (b.qualification as (typeof QUALIFICATIONS)[number])
    : "";
  const studyTime = STUDY_SLOTS.includes(b.studyTime as (typeof STUDY_SLOTS)[number])
    ? (b.studyTime as (typeof STUDY_SLOTS)[number])
    : "";
  const examDate = /^\d{4}-\d{2}-\d{2}$/.test(asString(b.examDate, 10)) ? asString(b.examDate, 10) : "";
  return {
    ...blankProfile(id),
    name: asString(b.name, 80),
    email: asString(b.email, 120),
    phone: asString(b.phone, 20),
    city: asString(b.city, 80),
    college: asString(b.college, 120),
    qualification,
    yearOfPassing: /^\d{4}$/.test(yearRaw) ? yearRaw : "",
    targetExam: asString(b.targetExam, 60),
    examDate,
    dailyGoal: Number.isFinite(dailyGoalRaw) ? Math.max(0, Math.min(1440, Math.round(dailyGoalRaw))) : 0,
    studyTime,
    goals: asString(b.goals, 1000),
  };
}