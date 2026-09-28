import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Shared server-side Supabase client for API routes that proxy cloud reads and
// writes (study-plan cache, subjects). The browser never talks to Supabase
// directly; these routes use server secrets so RLS config can't silently block
// cross-device sync.
//
// Returns null when no real credentials are configured (e.g. local dev) so
// callers can fall back to other storage.
let serverClient: SupabaseClient | null = null;

const CLOUD_TIMEOUT_MS = 3000;
const CLOUD_COOLDOWN_MS = 60_000;
let cooldownUntil = 0;

// supabase.co can be DNS-blocked on some networks, which turns every cloud
// read/write into a ~15s hang. Fail fast with AbortSignal and, once the cloud
// fails, skip it entirely for a while so the app instantly serves from the
// local file mirror instead of stalling on each request.
function timedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLOUD_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal })
    .finally(() => clearTimeout(timer))
    .catch((err: unknown) => {
      cooldownUntil = Date.now() + CLOUD_COOLDOWN_MS;
      throw err;
    });
}

function markReachable(): void {
  cooldownUntil = 0;
}

export function getServerSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.startsWith("your_") || key.startsWith("your_")) return null;
  if (Date.now() < cooldownUntil) return null;
  if (!serverClient) {
    serverClient = createClient(url, key, {
      auth: { persistSession: false },
      db: { retry: false },
      global: { fetch: timedFetch },
    });
  }
  return serverClient;
}

export { markReachable };