import { Redis } from "@upstash/redis";

// Shared server-side Upstash Redis client for API routes that proxy cloud reads
// and writes (study-plan cache, subjects). The browser never talks to Redis
// directly; these routes use the REST URL + token so cross-device sync works.
//
// Returns null when no real credentials are configured (e.g. local dev) so
// callers can fall back to the local file mirror.
let serverRedis: Redis | null = null;

const CLOUD_TIMEOUT_MS = 3000;
const CLOUD_COOLDOWN_MS = 60_000;
let cooldownUntil = 0;

export function getServerRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || url.startsWith("your_") || token.startsWith("your_")) return null;
  // While the cloud is on cooldown (recently failed), skip it entirely so the
  // app instantly serves from the local file mirror instead of stalling.
  if (Date.now() < cooldownUntil) return null;
  if (!serverRedis) {
    serverRedis = new Redis({
      url,
      token,
      automaticDeserialization: false,
    });
  }
  return serverRedis;
}

export function markRedisReachable(): void {
  cooldownUntil = 0;
}

export function markRedisUnreachable(): void {
  cooldownUntil = Date.now() + CLOUD_COOLDOWN_MS;
}