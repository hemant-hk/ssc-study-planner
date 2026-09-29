import { NextRequest } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { isAdminRequest } from "@/lib/auth-store";
import { getServerRedis, markRedisReachable, markRedisUnreachable, hgetallToRecord } from "@/lib/server-redis";

// Subjects (and the study plans embedded in their videos) are stored in the
// cloud via Upstash Redis so they survive refreshes and sync across devices.
// The filesystem data/subjects.json is used only as a local fallback (e.g. dev
// machines or until the first cloud read populates it).
//
// One Redis hash field per subject keeps deletes precise: only an explicit
// user delete removes the field, so removed subjects don't resurrect.
const DATA_FILE = path.join(process.cwd(), "data", "subjects.json");
const SUBJECTS_HASH = "subjects";
const KEY_PREFIX = "subject:";
// Short-lived in-memory cache so a hard refresh doesn't round-trip the whole
// cloud hash (subjects can embed large study plans) every time. Reads are the
// hot path; every write (POST/PUT/DELETE) invalidates it below.
const SUBJECTS_CACHE_TTL_MS = 30_000;
let subjectsCache: { at: number; data: string } | null = null;

function getCachedSubjectsPayload(): string | null {
  if (!subjectsCache) return null;
  if (Date.now() - subjectsCache.at > SUBJECTS_CACHE_TTL_MS) return null;
  return subjectsCache.data;
}

function cacheSubjectsPayload(payload: string): void {
  subjectsCache = { at: Date.now(), data: payload };
}
// Marker field written once after the local file is migrated to the cloud. Its
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
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? (parsed as Subject[]) : [];
  } catch {
    return [];
  }
}

async function writeFileSubjects(subjects: Subject[]): Promise<void> {
  await writeFile(DATA_FILE, JSON.stringify(subjects, null, 2));
}

// { reachable: false } means Redis is not configured or an error occurred
// reading it (treat as no cloud → fall back to the local file). { reachable:
// true } with an empty array means the cloud genuinely has no subjects — that
// is the authoritative empty state (everything deleted), never re-seeded.
async function readCloudSubjects(): Promise<{ reachable: boolean; subjects: Subject[] }> {
  const redis = getServerRedis();
  if (!redis) return { reachable: false, subjects: [] };
  try {
    const all = await redis.hgetall(SUBJECTS_HASH);
    markRedisReachable();
    const subjects: Subject[] = [];
    for (const [rawKey, rawValue] of Object.entries(hgetallToRecord(all))) {
      if (!rawKey.startsWith(KEY_PREFIX) || rawKey === SEED_MARKER) continue;
      try {
        const s = JSON.parse(rawValue as string) as Subject;
        if (s && typeof s.id === "string" && Array.isArray(s.videos)) subjects.push(s);
      } catch {
        // Corrupt entry — skip it.
      }
    }
    return { reachable: true, subjects };
  } catch {
    markRedisUnreachable();
    return { reachable: false, subjects: [] };
  }
}

async function writeCloudSubjects(subjects: Subject[]): Promise<boolean> {
  const redis = getServerRedis();
  if (!redis) return false;
  try {
    const fields: Record<string, string> = {};
    for (const s of subjects) fields[`${KEY_PREFIX}${s.id}`] = JSON.stringify(s);
    if (Object.keys(fields).length > 0) {
      await redis.hset(SUBJECTS_HASH, fields);
    }
    markRedisReachable();
    return true;
  } catch {
    markRedisUnreachable();
    return false;
  }
}

async function hasSeedMarker(): Promise<boolean> {
  const redis = getServerRedis();
  if (!redis) return true; // Not configured: treat as seeded so we never seed.
  try {
    const value = await redis.hget(SUBJECTS_HASH, SEED_MARKER);
    markRedisReachable();
    return !!value;
  } catch {
    markRedisUnreachable();
    return true;
  }
}

async function deleteCloudSubject(subjectId: string): Promise<boolean> {
  const redis = getServerRedis();
  if (!redis) return false;
  try {
    await redis.hdel(SUBJECTS_HASH, `${KEY_PREFIX}${subjectId}`);
    markRedisReachable();
    return true;
  } catch {
    markRedisUnreachable();
    return false;
  }
}

// Prefers cloud. If Redis is configured and reachable, the cloud is
// authoritative — an empty cloud means "everything was deleted", so a stale
// local file can never resurrect rows. The local file is migrated to the cloud
// once (guarded by SEED_MARKER) so existing data survives the move.
async function readSubjects(): Promise<Subject[]> {
  const { reachable, subjects } = await readCloudSubjects();
  if (reachable) return subjects;

  // Cloud not configured/reachable: use the local file (no migration possible).
  const local = await readFileSubjects();
  const redis = getServerRedis();
  if (redis && local.length > 0 && !(await hasSeedMarker())) {
    await writeCloudSubjects(local);
    try {
      await redis.hset(SUBJECTS_HASH, { [SEED_MARKER]: "1" });
      markRedisReachable();
    } catch {
      markRedisUnreachable();
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
  return isAdminRequest(request);
}

export async function GET() {
  try {
    const cached = getCachedSubjectsPayload();
    if (cached) {
      return new Response(cached, {
        headers: { "Content-Type": "application/json", "Cache-Control": "max-age=0, s-maxage=0, no-cache" },
      });
    }
    const subjects = await readSubjects();
    const payload = JSON.stringify(subjects);
    cacheSubjectsPayload(payload);
    return new Response(payload, {
      headers: { "Content-Type": "application/json", "Cache-Control": "max-age=0, s-maxage=0, no-cache" },
    });
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
    subjectsCache = null;
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
    subjectsCache = null;
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
    subjectsCache = null;
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Failed to delete subject" }, { status: 500 });
  }
}