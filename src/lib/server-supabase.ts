import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Shared server-side Supabase client for API routes that proxy cloud reads and
// writes (study-plan cache, subjects). The browser never talks to Supabase
// directly; these routes use server secrets so RLS config can't silently block
// cross-device sync.
//
// Returns null when no real credentials are configured (e.g. local dev) so
// callers can fall back to other storage.
let serverClient: SupabaseClient | null = null;

export function getServerSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.startsWith("your_") || key.startsWith("your_")) return null;
  if (!serverClient) {
    serverClient = createClient(url, key, { auth: { persistSession: false } });
  }
  return serverClient;
}