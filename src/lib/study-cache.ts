import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { StudyPlan } from "./gemini";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Study plans are stored in the Supabase `study_cache` table instead of local
// files (read-only on serverless runtimes like Vercel) or localStorage (lost on
// other devices). Rows: key = videoId, data = plan (jsonb).
//
// The anon key is safe to use from the browser; make sure the table grants the
// anon role SELECT/INSERT/UPDATE/DELETE via RLS for it to work in production.
//
// Offline / ISP-blocked fallback: Supabase is the primary store, but when a
// network failure (ERR_NAME_NOT_RESOLVED, "fetch failed", DNS errors, etc.)
// makes it unreachable we gracefully fall back to the browser's localStorage
// so cached plans survive outages. Reads try Supabase first and fall back to
// localStorage; writes go to both places.
const TABLE = "study_cache";
const LS_PREFIX = "studycache:";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}

// True when Supabase is unreachable due to a network problem (DNS resolution,
// ISP block, offline, connection reset). Supabase-js surfaces these as thrown
// fetch errors ("fetch failed" / "Failed to fetch") or as an error payload.
function isNetworkError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION|fetch failed|failed to fetch|networkerror|network error|network request failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|load failed/i.test(
    message
  );
}

function canUseLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function lsKey(videoId: string): string {
  return `${LS_PREFIX}${videoId}`;
}

function lsReadAll(): Record<string, StudyPlan> {
  if (!canUseLocalStorage()) return {};
  try {
    const plans: Record<string, StudyPlan> = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(LS_PREFIX)) continue;
      const videoId = key.slice(LS_PREFIX.length);
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        plans[videoId] = JSON.parse(raw) as StudyPlan;
      } catch {
        // Corrupt/partial entries are best-effort; skip them.
      }
    }
    return plans;
  } catch {
    return {};
  }
}

function lsRead(videoId: string): StudyPlan | null {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(lsKey(videoId));
    return raw ? (JSON.parse(raw) as StudyPlan) : null;
  } catch {
    return null;
  }
}

function lsWrite(videoId: string, plan: StudyPlan): void {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(lsKey(videoId), JSON.stringify(plan));
  } catch {
    // localStorage quota/security errors are best-effort; Supabase is primary.
  }
}

function lsDelete(videoId: string): void {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.removeItem(lsKey(videoId));
  } catch {
    // Best-effort cleanup.
  }
}

export async function getCachedPlans(): Promise<Record<string, StudyPlan>> {
  const localPlans = lsReadAll();
  const db = getClient();
  if (!db) return localPlans;
  try {
    const { data, error } = await db.from(TABLE).select("key, data");
    if (error || !data) return localPlans;
    const plans: Record<string, StudyPlan> = { ...localPlans };
    for (const row of data) {
      if (row.key) plans[row.key as string] = row.data as StudyPlan;
    }
    return plans;
  } catch (err) {
    if (isNetworkError(err)) return localPlans;
    return {};
  }
}

export async function getCachedPlan(videoId: string): Promise<StudyPlan | null> {
  const localPlan = lsRead(videoId);
  const db = getClient();
  if (!db) return localPlan;
  try {
    const { data, error } = await db.from(TABLE).select("data").eq("key", videoId).maybeSingle();
    if (error || !data) return localPlan;
    return data.data as StudyPlan;
  } catch (err) {
    if (isNetworkError(err)) return localPlan;
    return null;
  }
}

export async function setCachedPlan(videoId: string, plan: StudyPlan): Promise<void> {
  // Write to both stores so the plan survives offline sessions unchanged.
  lsWrite(videoId, plan);
  const db = getClient();
  if (!db) return;
  try {
    await db.from(TABLE).upsert({ key: videoId, data: plan }, { onConflict: "key" });
  } catch {
    // Cache writes are best-effort; the localStorage copy above persists.
  }
}

export async function deleteCachedPlan(videoId: string): Promise<void> {
  lsDelete(videoId);
  const db = getClient();
  if (!db) return;
  try {
    await db.from(TABLE).delete().eq("key", videoId);
  } catch {
    // Best-effort cleanup.
  }
}