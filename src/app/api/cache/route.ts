import { NextRequest } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import type { StudyPlan } from "@/lib/gemini";
import { getServerRedis, markRedisReachable, markRedisUnreachable } from "@/lib/server-redis";

// Server-side store for the study-plan cache. The browser talks to this route
// instead of Redis directly, so cross-device sync always works through the
// server REST URL + token.
//
//   GET  /api/cache          -> { plans: { [videoId]: StudyPlan } }
//   GET  /api/cache?key=vid  -> { plan: StudyPlan | null }
//   POST /api/cache          -> body { key, data }  -> upsert (by key)
//   DELETE /api/cache        -> body { key }        -> delete row
//
// Storage is tiered: Upstash Redis (cloud) is the permanent source of truth,
// and a local JSON file mirrors it when the cloud is unreachable or not
// configured. That way the plans still sync across devices that share this
// server (e.g. the daytona preview) even when Redis is blocked on the network.
const CACHE_HASH = "study_cache";
// Filesystem mirror (like data/subjects.json). Used when Redis is
// unreachable/not configured so data isn't lost and still syncs server-side.
const DATA_FILE = path.join(process.cwd(), "data", "study-cache.json");

function isNetworkError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /fetch failed|failed to fetch|networkerror|network error|network request failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|load failed|could not resolve host/i.test(
    message
  );
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

// Cloud-first read; falls back to the local file mirror when Redis is not
// configured or unreachable. Returns { plans, cloud: boolean }.
async function readPlans(): Promise<{ plans: Record<string, StudyPlan>; cloud: boolean }> {
  const redis = getServerRedis();
  if (!redis) return { plans: await readFileCache(), cloud: false };
  try {
    const all = await redis.hgetall(CACHE_HASH);
    markRedisReachable();
    const plans: Record<string, StudyPlan> = {};
    for (const [rawKey, rawValue] of Object.entries(all || {})) {
      // Skip subject rows (key = "subject:<id>") — those belong to /api/subjects.
      if (rawKey.startsWith("subject:")) continue;
      try {
        plans[rawKey] = JSON.parse(rawValue as string) as StudyPlan;
      } catch {
        // Corrupt entries are best-effort; skip them.
      }
    }
    return { plans, cloud: true };
  } catch (err) {
    markRedisUnreachable();
    if (isNetworkError(err)) return { plans: await readFileCache(), cloud: false };
    return { plans: await readFileCache(), cloud: false };
  }
}

async function readPlan(videoId: string): Promise<{ plan: StudyPlan | null; cloud: boolean }> {
  const redis = getServerRedis();
  if (!redis) return { plan: (await readFileCache())[videoId] ?? null, cloud: false };
  try {
    const raw = await redis.hget(CACHE_HASH, videoId);
    markRedisReachable();
    if (!raw) return { plan: null, cloud: true };
    return { plan: JSON.parse(raw as string) as StudyPlan, cloud: true };
  } catch (err) {
    markRedisUnreachable();
    if (isNetworkError(err)) return { plan: (await readFileCache())[videoId] ?? null, cloud: false };
    return { plan: (await readFileCache())[videoId] ?? null, cloud: false };
  }
}

export async function GET(request: NextRequest) {
  // Lightweight probe for the UI badge: reports WHICH store answered.
  //   cloud -> plan cache served from Upstash Redis cloud
  //   file  -> cloud unreachable/not configured, served from this server's file
  //   local -> nothing on this server, fall back to browser storage
  if (request.nextUrl.searchParams.get("probe") === "1") {
    const redis = getServerRedis();
    let cloud = false;
    if (redis) {
      try {
        await redis.hget(CACHE_HASH, "__probe__");
        cloud = true;
        markRedisReachable();
      } catch {
        markRedisUnreachable();
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
    if (cloud) return Response.json({ plan: null });
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

    const redis = getServerRedis();
    if (redis) {
      try {
        await redis.hset(CACHE_HASH, { [key]: JSON.stringify(body.data ?? {}) });
        markRedisReachable();
        return Response.json({ ok: true });
      } catch (err) {
        markRedisUnreachable();
        if (isNetworkError(err)) {
          // Cloud unreachable but local file mirror succeeded — fine.
          return Response.json({ ok: true, store: "file" });
        }
      }
    }
    if (fileError === null) return Response.json({ ok: true, store: "file" });
    return Response.json({ error: fileError || "Failed to save plan" }, { status: 500 });
  } catch (err) {
    if (isNetworkError(err)) {
      return Response.json({ error: "REDIS_UNREACHABLE" }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Redis error";
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

    const redis = getServerRedis();
    if (redis) {
      try {
        await redis.hdel(CACHE_HASH, key);
        markRedisReachable();
        return Response.json({ ok: true });
      } catch {
        markRedisUnreachable();
        // Cloud unreachable — the local file mirror deletion already handled it.
      }
    }
    return Response.json({ ok: true });
  } catch (err) {
    if (isNetworkError(err)) {
      return Response.json({ error: "REDIS_UNREACHABLE" }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Redis error";
    return Response.json({ error: message }, { status: 500 });
  }
}