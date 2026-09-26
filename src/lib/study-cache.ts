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
    // Server-side Supabase not configured (503): nothing to sync from, and the
    // request reached the server so the network is fine — still serve local.
    if (res.status === 503) return lsReadAll();
    return {};
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
    if (res.status === 503) return lsRead(videoId);
    return null;
  } catch (err) {
    if (isNetworkError(err)) return lsRead(videoId);
    return null;
  }
}

export async function setCachedPlan(videoId: string, plan: StudyPlan): Promise<void> {
  // Supabase (via /api/cache) is the source of truth for cross-device sync.
  // localStorage gets a copy only when the write couldn't reach the server
  // (offline / server Supabase not configured) so it persists as a fallback.
  try {
    const res = await fetch("/api/cache", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: videoId, data: plan }),
    });
    if (res.ok) return;
    if (res.status === 503) lsWrite(videoId, plan);
  } catch (err) {
    // Truly offline: keep the plan locally so it isn't lost.
    if (isNetworkError(err)) lsWrite(videoId, plan);
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