import { NextRequest } from "next/server";
import type { StudyPlan } from "@/lib/gemini";
import { getServerSupabase } from "@/lib/server-supabase";

// Server-side proxy for the `study_cache` table. The browser no longer talks to
// Supabase directly (which depended on anon-key + RLS config that can block
// cross-device reads). Instead the client calls this route, which uses the
// server secrets so reads/writes always work across devices.
//
//   GET  /api/cache          -> { plans: { [videoId]: StudyPlan } }
//   GET  /api/cache?key=vid  -> { plan: StudyPlan | null }
//   POST /api/cache          -> body { key, data }  -> upsert (by key)
//   DELETE /api/cache        -> body { key }        -> delete row
//
// "fetch failed" / DNS / network errors return 503 so the client falls back to
// its localStorage copy instead of treating the response as an empty cache.
const TABLE = "study_cache";

function isNetworkError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /fetch failed|failed to fetch|networkerror|network error|network request failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|load failed|could not resolve host/i.test(
    message
  );
}

// supabase-js surfaces network failures as an `error` object (message like
// "fetch failed") on some paths instead of throwing — map those to 503 too.
function supabaseErrorResponse(error: { message?: string }): Response {
  if (error && isNetworkError(error.message || "")) {
    return Response.json({ error: "SUPABASE_UNREACHABLE" }, { status: 503 });
  }
  return Response.json({ error: error?.message ?? "Supabase error" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  const db = getServerSupabase();
  if (!db) {
    return Response.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  }
  try {
    const videoId = request.nextUrl.searchParams.get("key");
    if (videoId) {
      const { data, error } = await db
        .from(TABLE)
        .select("data")
        .eq("key", videoId)
        .maybeSingle();
      if (error) return supabaseErrorResponse(error);
      return Response.json({ plan: data ? (data.data as StudyPlan) : null });
    }
    const { data, error } = await db.from(TABLE).select("key, data");
    if (error) return supabaseErrorResponse(error);
    const plans: Record<string, StudyPlan> = {};
    for (const row of data || []) {
      // Skip subject rows (key = "subject:<id>") — those belong to /api/subjects.
      if (typeof row.key !== "string" || row.key.startsWith("subject:")) continue;
      if (row.key) plans[row.key as string] = row.data as StudyPlan;
    }
    return Response.json({ plans });
  } catch (err) {
    if (isNetworkError(err)) {
      return Response.json({ error: "SUPABASE_UNREACHABLE" }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Supabase error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const db = getServerSupabase();
  if (!db) {
    return Response.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  }
  try {
    const body: { key?: unknown; data?: unknown } = await request.json();
    const key = body.key;
    if (typeof key !== "string" || !key) {
      return Response.json({ error: "key is required" }, { status: 400 });
    }
    const { error } = await db
      .from(TABLE)
      .upsert({ key, data: body.data ?? {} }, { onConflict: "key" });
    if (error) return supabaseErrorResponse(error);
    return Response.json({ ok: true });
  } catch (err) {
    if (isNetworkError(err)) {
      return Response.json({ error: "SUPABASE_UNREACHABLE" }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Supabase error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const db = getServerSupabase();
  if (!db) {
    return Response.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  }
  try {
    const body: { key?: unknown } = await request.json();
    const key = body.key;
    if (typeof key !== "string" || !key) {
      return Response.json({ error: "key is required" }, { status: 400 });
    }
    const { error } = await db.from(TABLE).delete().eq("key", key);
    if (error) return supabaseErrorResponse(error);
    return Response.json({ ok: true });
  } catch (err) {
    if (isNetworkError(err)) {
      return Response.json({ error: "SUPABASE_UNREACHABLE" }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Supabase error";
    return Response.json({ error: message }, { status: 500 });
  }
}