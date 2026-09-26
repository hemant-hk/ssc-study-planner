import type { StudyPlan } from "./gemini";

// Study plans are cached in the Supabase `study_cache` table so they sync
// across devices. The browser talks to it through the server-side proxy at
// /api/cache (which uses the server Supabase secrets) instead of connecting to
// Supabase directly — that avoids anon-key/RLS config that can silently block
// cross-device reads.
//
// localStorage is used ONLY as an offline / ISP-blocked fallback: if the app
// is genuinely offline (DNS failure, no network), reads fall back to the
// browser's copy so previously generated plans still appear.
const LS_PREFIX = "studycache:";

// True when the device is truly offline (DNS resolution, ISP block, connection
// reset). Supabase-js / fetch surface these as thrown fetch errors.
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
  try {
    const res = await fetch("/api/cache");
    if (res.ok) {
      const body = (await res.json()) as { plans?: Record<string, StudyPlan> };
      return body.plans || {};
    }
    // Server couldn't serve from the cloud (503 not configured, 500 table
    // missing/RLS, etc.): fall back to the browser's copy so plans survive.
    return lsReadAll();
  } catch (err) {
    // Truly offline: fall back to the browser's copy.
    if (isNetworkError(err)) return lsReadAll();
    return {};
  }
}

export async function getCachedPlan(videoId: string): Promise<StudyPlan | null> {
  try {
    const res = await fetch(`/api/cache?key=${encodeURIComponent(videoId)}`);
    if (res.ok) {
      const body = (await res.json()) as { plan?: StudyPlan | null };
      return body.plan || null;
    }
    // Cloud unavailable for any reason -> fall back to the local copy.
    return lsRead(videoId);
  } catch (err) {
    if (isNetworkError(err)) return lsRead(videoId);
    return null;
  }
}

export async function setCachedPlan(videoId: string, plan: StudyPlan): Promise<void> {
  // Supabase (via /api/cache) is the source of truth for cross-device sync.
  // ALWAYS keep a local copy as a fallback: if the cloud write fails for any
  // reason (offline, Supabase not configured, table missing, RLS), the plan
  // still survives on this device instead of being lost forever.
  lsWrite(videoId, plan);
  try {
    const res = await fetch("/api/cache", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: videoId, data: plan }),
    });
    if (res.ok) return;
  } catch {
    // Stay offline-friendly: the local copy above is already in place.
  }
}

export async function deleteCachedPlan(videoId: string): Promise<void> {
  // Clean up both stores so a later offline read can't resurrect the plan.
  lsDelete(videoId);
  try {
    await fetch("/api/cache", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: videoId }),
    });
  } catch {
    // Best-effort cleanup; the local copy is already removed.
  }
}