import { NextRequest } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { isAdminBearer } from "@/lib/admin-password";

const DATA_FILE = path.join(process.cwd(), "data", "subjects.json");

interface Subject {
  id: string;
  name: string;
  color: string;
  videos: { videoId: string; title: string; thumbnailUrl: string; studyPlan: unknown | null }[];
  schedule: { day: string; startTime: string; endTime: string }[];
  createdAt: string;
}

async function readSubjects(): Promise<Subject[]> {
  if (!existsSync(DATA_FILE)) {
    return [];
  }
  const data = await readFile(DATA_FILE, "utf-8");
  return JSON.parse(data);
}

async function writeSubjects(subjects: Subject[]) {
  await writeFile(DATA_FILE, JSON.stringify(subjects, null, 2));
}

function isAdmin(request: NextRequest): Promise<boolean> {
  return isAdminBearer(request.headers.get("authorization"));
}

export async function GET() {
  try {
    const subjects = await readSubjects();
    return Response.json(subjects);
  } catch {
    return Response.json({ error: "Failed to read subjects" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin(request))) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const subjects = await readSubjects();
    const newSubject = await request.json();
    subjects.push(newSubject);
    await writeSubjects(subjects);
    return Response.json({ success: true, subject: newSubject });
  } catch {
    return Response.json({ error: "Failed to save subject" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!(await isAdmin(request))) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const subjects = await readSubjects();
    const updatedSubject = await request.json();
    const index = subjects.findIndex((s) => s.id === updatedSubject.id);
    if (index !== -1) {
      subjects[index] = updatedSubject;
    } else {
      subjects.push(updatedSubject);
    }
    await writeSubjects(subjects);
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Failed to update subject" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdmin(request))) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const { id } = await request.json();
    const subjects = await readSubjects();
    const filtered = subjects.filter((s) => s.id !== id);
    await writeSubjects(filtered);
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Failed to delete subject" }, { status: 500 });
  }
}
