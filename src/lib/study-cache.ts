import type { StudyPlan } from "./gemini";
import type { YouTubeVideoInfo } from "./youtube";

const PLANS_KEY = "yt-study-plans";
const VIDEO_INFO_KEY = "yt-study-video-info";

// Study plans and video metadata are cached in localStorage rather than on the
// server. Serverless runtimes (e.g. Vercel) mount the filesystem read-only, so
// writing data/*.json would throw EROFS. Keeping the cache on the client also
// lets plans survive across sessions without touching the filesystem.

function readMap<T>(key: string): Record<string, T> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap<T>(key: string, map: Record<string, T>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(map));
  } catch {
    // Storage unavailable or full (e.g. private mode); cache is best-effort.
  }
}

export function getCachedPlans(): Record<string, StudyPlan> {
  return readMap<StudyPlan>(PLANS_KEY);
}

export function setCachedPlan(videoId: string, plan: StudyPlan): void {
  const plans = getCachedPlans();
  plans[videoId] = plan;
  writeMap(PLANS_KEY, plans);
}

export function getCachedVideoInfo(): Record<string, YouTubeVideoInfo> {
  return readMap<YouTubeVideoInfo>(VIDEO_INFO_KEY);
}

export function setCachedVideoInfo(videoId: string, info: YouTubeVideoInfo): void {
  const map = getCachedVideoInfo();
  map[videoId] = info;
  writeMap(VIDEO_INFO_KEY, map);
}