import { NextRequest } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import type { StudyPlan } from "@/lib/gemini";
import { getServerSupabase } from "@/lib/server-supabase";

// Server-side store for the study-plan cache. The browser talks to this route
// instead of Supabase directly (which depended on anon-key + RLS config that
// could block cross-device reads), so it uses the server secrets and reads and
// writes always work across devices.
//
//   GET  /api/cache          -> { plans: { [videoId]: StudyPlan } }
//   GET  /api/cache?key=vid  -> { plan: StudyPlan | null }
//   POST /api/cache          -> body { key, data }  -> upsert (by key)
//   DELETE /api/cache        -> body { key }        -> delete row
//
// Storage is tiered: Supabase (cloud) is the permanent source of truth, and a
// local JSON file mirrors it when the cloud is unreachable or not configured.
// That way the plans still sync across devices that share this server (e.g. the
// daytona preview) even when supabase.co is blocked on the network.
const TABLE = "study_cache";
// Filesystem mirror (like data/subjects.json). Used when Supabase is
// unreachable/not configured so data isn't lost and still syncs server-side.
const DATA_FILE = path.join(process.cwd(), "data", "study-cache.json");

function isNetworkError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /fetch failed|failed to fetch|networkerror|network error|network request failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|load failed|could not resolve host/i.test(
    message
  );
}

// supabase-js surfaces network failures as an `error` object (message like
// "fetch failed") on some paths instead of throwing — treat those as a cloud
// outage so the local file mirror keeps serving.
function isCloudError(error: { message?: string }): boolean {
  return !!error && isNetworkError(error.message || "");
}

async function fileExists(): Promise<boolean> {
  return existsSync(DATA_FILE);
}

async function readFileCache(): Promise<Record<string, StudyPlan>> {
  if (!(await fileExists())) return {};
  try {
    const raw = await readFile(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, StudyPlan>;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

async function writeFileCache(plans: Record<string, StudyPlan>): Promise<void> {
  await writeFile(DATA_FILE, JSON.stringify(plans, null, 2));
}

// Cloud-first read; falls back to the local external-file mirror when Supabase
// is not configured or unreachable. Returns { plans, cloud: boolean }.
async function readPlans(): Promise<{ plans: Record<string, StudyPlan>; cloud: boolean }> {
  const db = getServerSupabase();
  if (!db) return { plans: await readFileCache(), cloud: false };
  try {
    const { data, error } = await db.from(TABLE).select("key, data");
    if (error) return { plans: await readFileCache(), cloud: false };
    const plans: Record<string, StudyPlan> = {};
    for (const row of data || []) {
      // Skip subject rows (key = "subject:<id>") — those belong to /api/subjects.
      if (typeof row.key !== "string" || row.key.startsWith("subject:")) continue;
      if (row.key) plans[row.key as string] = row.data as StudyPlan;
    }
    return { plans, cloud: true };
  } catch (err) {
    if (isNetworkError(err)) return { plans: await readFileCache(), cloud: false };
    return { plans: await readFileCache(), cloud: false };
  }
}

async function readPlan(videoId: string): Promise<{ plan: StudyPlan | null; cloud: boolean }> {
  const db = getServerSupabase();
  if (!db) return { plan: (await readFileCache())[videoId] ?? null, cloud: false };
  try {
    const { data, error } = await db
      .from(TABLE)
      .select("data")
      .eq("key", videoId)
      .maybeSingle();
    if (error) return { plan: (await readFileCache())[videoId] ?? null, cloud: false };
    return { plan: data ? (data.data as StudyPlan) : null, cloud: true };
  } catch (err) {
    if (isNetworkError(err)) return { plan: (await readFileCache())[videoId] ?? null, cloud: false };
    return { plan: (await readFileCache())[videoId] ?? null, cloud: false };
  }
}

export async function GET(request: NextRequest) {
  // Lightweight probe for the UI badge: reports WHICH store answered.
  //   cloud -> plan cache served from Supabase cloud
  //   file  -> cloud unreachable/not configured, served from this server's file
  //   local -> nothing on this server, fall back to browser storage
  if (request.nextUrl.searchParams.get("probe") === "1") {
    const db = getServerSupabase();
    let cloud = false;
    if (db) {
      try {
        const { error } = await db.from(TABLE).select("key").limit(1);
        cloud = !error;
      } catch {
        cloud = false;
      }
    }
    return Response.json({ store: cloud ? "cloud" : "file" });
  }

  const videoId = request.nextUrl.searchParams.get("key");
  if (videoId) {
    const { plan, cloud } = await readPlan(videoId);
    if (plan) return Response.json({ plan, store: cloud ? "cloud" : "file" });
    // No cloud copy and no file copy -> treat as absent, not as a failure.
    return Response.json({ plan: null });
  }
  const { plans, cloud } = await readPlans();
  return Response.json({ plans, store: cloud ? "cloud" : "file" });
}

export async function POST(request: NextRequest) {
  try {
    const body: { key?: unknown; data?: unknown } = await request.json();
    const key = body.key;
    if (typeof key !== "string" || !key) {
      return Response.json({ error: "key is required" }, { status: 400 });
    }
    // Always mirror to the local file so data survives even when the cloud is
    // down (also syncs across devices that share this server).
    let fileError: string | null = null;
    try {
      const plans = await readFileCache();
      plans[key] = (body.data ?? {}) as StudyPlan;
      await writeFileCache(plans);
    } catch (err) {
      fileError = err instanceof Error ? err.message : "file write failed";
    }

    const db = getServerSupabase();
    if (db) {
      try {
        const { error } = await db
          .from(TABLE)
          .upsert({ key, data: body.data ?? {} }, { onConflict: "key" });
        if (!error) return Response.json({ ok: true });
        if (isCloudError(error)) {
          // Cloud unreachable but local file mirror succeeded — fine.
          return Response.json({ ok: true, store: "file" });
        }
      } catch (err) {
        if (isNetworkError(err)) {
          return Response.json({ ok: true, store: "file" });
        }
      }
    }
    if (fileError === null) return Response.json({ ok: true, store: "file" });
    return Response.json({ error: fileError || "Failed to save plan" }, { status: 500 });
  } catch (err) {
    if (isNetworkError(err)) {
      return Response.json({ error: "SUPABASE_UNREACHABLE" }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Supabase error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body: { key?: unknown } = await request.json();
    const key = body.key;
    if (typeof key !== "string" || !key) {
      return Response.json({ error: "key is required" }, { status: 400 });
    }
    // Remove from the local file mirror too, so it can't resurrect later.
    try {
      const plans = await readFileCache();
      delete plans[key];
      await writeFileCache(plans);
    } catch {
      // Best-effort file cleanup; at least the cloud delete below is exact.
    }

    const db = getServerSupabase();
    if (db) {
      try {
        const { error } = await db.from(TABLE).delete().eq("key", key);
        if (!error) return Response.json({ ok: true });
      } catch {
        // Cloud unreachable — the local file mirror deletion already handled it.
      }
    }
    return Response.json({ ok: true });
  } catch (err) {
    if (isNetworkError(err)) {
      return Response.json({ error: "SUPABASE_UNREACHABLE" }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Supabase error";
    return Response.json({ error: message }, { status: 500 });
  }
}