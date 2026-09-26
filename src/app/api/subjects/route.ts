import { NextRequest } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { isAdminBearer } from "@/lib/admin-password";
import { getServerSupabase } from "@/lib/server-supabase";

// Subjects (and the study plans embedded in their videos) are stored in the
// cloud via Supabase so they survive refreshes and sync across devices. The
// filesystem data/subjects.json is used only as a local fallback (e.g. dev
// machines or until the first cloud read populates it).
//
// One Supabase row per subject keeps deletes precise: only an explicit
// user delete removes the row, so removed subjects don't resurrect.
const DATA_FILE = path.join(process.cwd(), "data", "subjects.json");
const TABLE = "study_cache";
const KEY_PREFIX = "subject:";
// Marker row written once after the local file is migrated to the cloud. Its
// presence means "the file already seeded the cloud", so an empty cloud is a
// real empty state (user deleted everything) rather than "not yet migrated" —
// preventing deleted subjects from resurrecting from a stale local file.
const SEED_MARKER = "subject:__seeded__";

interface Subject {
  id: string;
  name: string;
  color: string;
  videos: { videoId: string; title: string; thumbnailUrl: string; studyPlan: unknown | null }[];
  schedule: { day: string; startTime: string; endTime: string }[];
  createdAt: string;
}

function fileExists(): boolean {
  return existsSync(DATA_FILE);
}

async function readFileSubjects(): Promise<Subject[]> {
  if (!fileExists()) return [];
  const data = await readFile(DATA_FILE, "utf-8");
  return JSON.parse(data);
}

async function writeFileSubjects(subjects: Subject[]): Promise<void> {
  await writeFile(DATA_FILE, JSON.stringify(subjects, null, 2));
}

// { reachable: false } means Supabase is not configured or an error occurred
// reading it (treat as no cloud → fall back to the local file). { reachable:
// true } with an empty array means the cloud genuinely has no subjects — that
// is the authoritative empty state (everything deleted), never re-seeded.
async function readCloudSubjects(): Promise<{ reachable: boolean; subjects: Subject[] }> {
  const db = getServerSupabase();
  if (!db) return { reachable: false, subjects: [] };
  try {
    const { data, error } = await db.from(TABLE).select("key, data");
    if (error || !data) return { reachable: false, subjects: [] };
    const rows = data.filter((r) => typeof r.key === "string" && r.key.startsWith(KEY_PREFIX));
    const subjects = rows
      .map((r) => r.data as Subject)
      .filter((s) => s && typeof s.id === "string" && Array.isArray(s.videos));
    return { reachable: true, subjects };
  } catch {
    return { reachable: false, subjects: [] };
  }
}

async function writeCloudSubjects(subjects: Subject[]): Promise<boolean> {
  const db = getServerSupabase();
  if (!db) return false;
  try {
    const rows = subjects.map((s) => ({ key: `${KEY_PREFIX}${s.id}`, data: s }));
    const { error } = await db.from(TABLE).upsert(rows, { onConflict: "key" });
    return !error;
  } catch {
    return false;
  }
}

async function hasSeedMarker(): Promise<boolean> {
  const db = getServerSupabase();
  if (!db) return true; // Not configured: treat as seeded so we never seed.
  try {
    const { data, error } = await db.from(TABLE).select("key").eq("key", SEED_MARKER).maybeSingle();
    if (error) return true;
    return !!data;
  } catch {
    return true;
  }
}

async function deleteCloudSubject(subjectId: string): Promise<boolean> {
  const db = getServerSupabase();
  if (!db) return false;
  try {
    const { error } = await db.from(TABLE).delete().eq("key", `${KEY_PREFIX}${subjectId}`);
    return !error;
  } catch {
    return false;
  }
}

// Prefers cloud. If Supabase is configured and reachable, the cloud is
// authoritative — an empty cloud means "everything was deleted", so a stale
// local file can never resurrect rows. The local file is migrated to the cloud
// once (guarded by SEED_MARKER) so existing data survives the move.
async function readSubjects(): Promise<Subject[]> {
  const { reachable, subjects } = await readCloudSubjects();
  if (reachable) return subjects;

  // Cloud not configured/reachable: use the local file (no migration possible).
  const local = await readFileSubjects();
  const db = getServerSupabase();
  if (db && local.length > 0 && !(await hasSeedMarker())) {
    await writeCloudSubjects(local);
    try {
      await db.from(TABLE).upsert({ key: SEED_MARKER, data: {} }, { onConflict: "key" });
    } catch {
      // Marker write is best-effort; a retry next read will still migrate.
    }
  }
  return local;
}

// Writes to both stores: cloud is the permanent source of truth, the file is a
// best-effort local mirror (ignored on read-only serverless runtimes).
async function persistSubjects(subjects: Subject[]): Promise<void> {
  const cloudOk = await writeCloudSubjects(subjects);
  try {
    await writeFileSubjects(subjects);
  } catch {
    if (!cloudOk) throw new Error("Failed to persist subjects");
  }
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
    await persistSubjects(subjects);
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
    await persistSubjects(subjects);
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
    // Remove exactly this subject from the cloud and the local mirror.
    await deleteCloudSubject(id);
    const subjects = await readFileSubjects();
    const filtered = subjects.filter((s) => s.id !== id);
    try {
      await writeFileSubjects(filtered);
    } catch {
      // Rule: only write the file if we can; the cloud delete is authoritative.
    }
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Failed to delete subject" }, { status: 500 });
  }
}