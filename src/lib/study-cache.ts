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
const TABLE = "study_cache";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}

export async function getCachedPlans(): Promise<Record<string, StudyPlan>> {
  const db = getClient();
  if (!db) return {};
  try {
    const { data, error } = await db.from(TABLE).select("key, data");
    if (error || !data) return {};
    const plans: Record<string, StudyPlan> = {};
    for (const row of data) {
      if (row.key) plans[row.key as string] = row.data as StudyPlan;
    }
    return plans;
  } catch {
    return {};
  }
}

export async function getCachedPlan(videoId: string): Promise<StudyPlan | null> {
  const db = getClient();
  if (!db) return null;
  try {
    const { data, error } = await db.from(TABLE).select("data").eq("key", videoId).maybeSingle();
    if (error || !data) return null;
    return data.data as StudyPlan;
  } catch {
    return null;
  }
}

export async function setCachedPlan(videoId: string, plan: StudyPlan): Promise<void> {
  const db = getClient();
  if (!db) return;
  try {
    await db.from(TABLE).upsert({ key: videoId, data: plan }, { onConflict: "key" });
  } catch {
    // Cache writes are best-effort; generation still succeeds if this fails.
  }
}

export async function deleteCachedPlan(videoId: string): Promise<void> {
  const db = getClient();
  if (!db) return;
  try {
    await db.from(TABLE).delete().eq("key", videoId);
  } catch {
    // Best-effort cleanup.
  }
}